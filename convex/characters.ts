import { v } from "convex/values";
import {
  query,
  mutation,
  internalAction,
  internalMutation,
} from "./_generated/server";
import { auth } from "./auth";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import Replicate from "replicate"; // <-- 引入官方库
import { CREDIT_COSTS } from "./schema"; // <-- 引入成本定义

// 新的角色列表返回类型
export type CharacterForList = {
  _id: Id<"characters">;
  name: string;
  status: "pending" | "training" | "ready" | "failed";
  failureReason?: string | null;
  coverImageUrl: string | null;
};

// 查询当前用户的所有角色
export const list = query({
  handler: async (ctx): Promise<CharacterForList[]> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return Promise.all(
      characters.map(async (character) => {
        const coverImageUrl = character.coverImageId
          ? await ctx.storage.getUrl(character.coverImageId)
          : null;
        return {
          _id: character._id,
          name: character.name,
          status: character.status,
          failureReason: character.failureReason ?? null,
          coverImageUrl,
        };
      }),
    );
  },
});

// [NEW] Query to get only characters that are ready for generation
export const getReady = query({
  handler: async (ctx): Promise<CharacterForList[]> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      // Filter for only 'ready' characters
      .filter((q) => q.eq(q.field("status"), "ready"))
      .order("desc")
      .collect();

    return Promise.all(
      characters.map(async (character) => {
        const coverImageUrl = character.coverImageId
          ? await ctx.storage.getUrl(character.coverImageId)
          : null;
        return {
          _id: character._id,
          name: character.name,
          status: character.status,
          failureReason: character.failureReason ?? null,
          coverImageUrl,
        };
      }),
    );
  },
});

// 创建角色记录并调度训练任务
export const create = mutation({
  args: {
    name: v.string(),
    coverImageId: v.id("_storage"),
    trainingDataZipId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to create a character.");
    }
    const characterId = await ctx.db.insert("characters", {
      userId,
      name: args.name,
      coverImageId: args.coverImageId,
      trainingDataZipId: args.trainingDataZipId,
      status: "pending",
    });
    // [FIX] Use api.internal to schedule an internal action
    await ctx.scheduler.runAfter(0, internal.characters.startTraining, {
      characterId: characterId,
    });
    return characterId;
  },
});

// 供内部Action使用的辅助查询
export const getSystem = query({
  args: { characterId: v.id("characters") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.characterId);
  },
});

// Action: 基于您的参考代码重构的全新训练流程
export const startTraining = internalAction({
  args: { characterId: v.id("characters") },
  handler: async (ctx, args) => {
    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
    if (!REPLICATE_API_TOKEN)
      throw new Error("REPLICATE_API_TOKEN is not set.");
    const REPLICATE_USERNAME = process.env.REPLICATE_USERNAME;
    if (!REPLICATE_USERNAME) throw new Error("REPLICATE_USERNAME is not set.");
    // [FIX] 使用 Convex 内置的、由 --tunnel 自动提供的环境变量
    const convexSiteUrl = process.env.CONVEX_SITE_URL;
    if (!convexSiteUrl)
      throw new Error(
        "CONVEX_SITE_URL is not set. Make sure you are running `npx convex dev --tunnel`",
      );

    const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

    const character = await ctx.runQuery(api.characters.getSystem, {
      characterId: args.characterId,
    });
    if (!character) throw new Error("Character not found");

    try {
      // --- 点数系统集成 ---
      await ctx.runMutation(internal.credits.consumeCredits, {
        userId: character.userId,
        cost: CREDIT_COSTS.LORA_TRAINING,
      });
      // --- 点数系统集成结束 ---

      const trainingDataUrl = await ctx.storage.getUrl(
        character.trainingDataZipId,
      );
      if (!trainingDataUrl) throw new Error("Could not get training data URL.");

      // 1. 创建唯一的模型目标地址
      // [FIX] 确保 destination 为全小写，以符合 Replicate 的命名规则
      const destination = `${REPLICATE_USERNAME}/${character._id.toLowerCase()}`;

      // 2. [关键步骤] 先在Replicate上创建空模型
      // [FIX] 此处创建时，名称也必须是小写的
      await replicate.models.create(
        REPLICATE_USERNAME,
        character._id.toLowerCase(),
        {
          visibility: "private",
          hardware: "gpu-t4", // 或者其他您需要的硬件
        },
      );

      // [改进1] 为每个角色生成一个唯一的触发词，防止模型污染
      const triggerWord = `sks_${character._id.toLowerCase()}`;
      // [改进2] 简化 Webhook URL，只传递 characterId，实现解耦
      const webhookUrl = `${convexSiteUrl}/replicate-webhook?characterId=${character._id}`;

      // 4. 开始训练
      const training = await replicate.trainings.create(
        "replicate", // 模型所有者
        "fast-flux-trainer", // 模型名称
        "56cb4a6447e586e40c6834a7a48b649336ade35325479817ada41cd3d8dcc175", // 使用最新的模型版本
        {
          destination: destination as `${string}/${string}`,
          webhook: webhookUrl,
          webhook_events_filter: ["completed"],
          input: {
            input_images: trainingDataUrl,
            // [改进1] 使用唯一的触发词
            trigger_word: triggerWord,
            lora_type: "subject",
          },
        },
      );

      // 5. 更新数据库状态，并保存唯一的触发词
      await ctx.runMutation(internal.characters.updateTrainingStatus, {
        characterId: args.characterId,
        status: "training",
        replicateTrainingId: training.id,
        replicateModelDestination: destination,
        // [改进1] 将生成的唯一触发词存入数据库
        triggerWord: triggerWord,
      });
    } catch (error: any) {
      console.error("Training Error: ", error);
      // [改进] 失败时也应该退还点数
      await ctx.runMutation(internal.credits.refundTrainingCredits, {
        userId: character.userId,
      });
      await ctx.runMutation(internal.characters.updateTrainingStatus, {
        characterId: args.characterId,
        status: "failed",
        failureReason:
          error instanceof Error ? error.message : "Failed to start training.",
      });
    }
  },
});

// 内部Mutation: 更新角色的训练状态
export const updateTrainingStatus = internalMutation({
  args: {
    characterId: v.id("characters"),
    status: v.union(
      v.literal("training"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    replicateTrainingId: v.optional(v.string()),
    replicateModelDestination: v.optional(v.string()),
    replicateModelVersion: v.optional(v.string()),
    triggerWord: v.optional(v.string()),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { characterId, ...rest } = args;
    await ctx.db.patch(characterId, rest);
  },
});

// [FIX] Action: 删除 Replicate 上的模型 (使用 fetch)
export const deleteReplicateModel = internalAction({
  args: { destination: v.string() },
  handler: async (_ctx, args) => {
    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
    if (!REPLICATE_API_TOKEN) {
      console.warn(
        "REPLICATE_API_TOKEN not set. Skipping Replicate model deletion.",
      );
      return;
    }
    try {
      // `replicate-javascript` 客户端库没有 `models.delete` 方法。
      // 我们必须直接使用 fetch 调用 Replicate 的 HTTP API。
      const [owner, name] = args.destination.split("/");

      const response = await fetch(
        `https://api.replicate.com/v1/models/${owner}/${name}`,
        {
          method: "DELETE",
          headers: {
            // 根据 Replicate 官方文档，使用 "Token"。
            Authorization: `Token ${REPLICATE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        console.log(
          `Successfully deleted replicate model: ${args.destination}`,
        );
      } else {
        // 这是一个尽力而为的清理操作，所以只记录错误而不抛出。
        const errorBody = await response.text();
        console.error(
          `Failed to delete replicate model ${args.destination}. Status: ${response.status}`,
          errorBody,
        );
      }
    } catch (error) {
      // 只记录意外错误。
      console.error(
        `An unexpected error occurred while trying to delete replicate model ${args.destination}`,
        error,
      );
    }
  },
});

// 删除角色
export const del = mutation({
  args: { characterId: v.id("characters") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId)
      throw new Error("You must be logged in to delete a character.");
    const character = await ctx.db.get(args.characterId);
    if (!character) throw new Error("Character not found.");
    if (character.userId !== userId)
      throw new Error("You are not authorized to delete this character.");
    if (character.status === "training")
      throw new Error("Cannot delete a character that is currently training.");

    // [IMPROVEMENT] 如果角色训练完成并有模型地址，则调度一个 action 去删除它
    if (character.replicateModelDestination) {
      await ctx.scheduler.runAfter(
        0,
        internal.characters.deleteReplicateModel,
        {
          destination: character.replicateModelDestination,
        },
      );
    }

    await ctx.storage.delete(character.coverImageId);
    await ctx.storage.delete(character.trainingDataZipId);
    await ctx.db.delete(args.characterId);
  },
});

// Action to clean up the training data zip file from storage
export const cleanupTrainingData = internalAction({
  args: { characterId: v.id("characters") },
  handler: async (ctx, args) => {
    const character = await ctx.runQuery(api.characters.getSystem, {
      characterId: args.characterId,
    });
    if (character && character.trainingDataZipId) {
      await ctx.storage.delete(character.trainingDataZipId);
    }
  },
});
