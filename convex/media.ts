import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  ActionCtx,
} from "./_generated/server";
import Replicate from "replicate";
import { Doc } from "./_generated/dataModel";
import { auth } from "./auth";
import OpenAI from "openai";

// --- Types for Search Results ---
type ImageSearchResult = Doc<"imageVersions"> & {
  resultType: "image"; // 修正: 避免与数据库字段命名冲突
  previewUrl: string | null;
  _score: number;
};

type VideoSearchResult = Doc<"videoClipVersions"> & {
  resultType: "video"; // 修正: 避免与数据库字段命名冲突
  previewUrl: string | null;
  videoUrl: string | null;
  _score: number;
};

type SearchResult = ImageSearchResult | VideoSearchResult;

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

const openai = new OpenAI();

// 1. 使用您找到的、经过验证的正确模型版本哈希
const CLIP_MODEL_AND_VERSION =
  "andreasjansson/clip-features:75b33f253f7714a281ad3e9b28f63e3232d583716ef6718f2e46641077ea040a";

async function getTextEmbedding(text: string): Promise<number[] | null> {
  if (!text) return null;
  try {
    const output = (await replicate.run(CLIP_MODEL_AND_VERSION, {
      input: {
        inputs: text,
      },
    })) as { input: string; embedding: number[] }[];
    return output[0]?.embedding;
  } catch (error) {
    console.error("Failed to get text embedding from Replicate", error);
    return null;
  }
}

// === 图片相关 ===
export const storeImageEmbedding = internalMutation({
  args: {
    imageVersionId: v.id("imageVersions"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, { imageVersionId, embedding }) => {
    await ctx.db.patch(imageVersionId, { embedding });
  },
});

export const generateEmbeddingForImage = internalAction({
  args: { imageVersionId: v.id("imageVersions") },
  handler: async (ctx, { imageVersionId }) => {
    const version = await ctx.runQuery(
      internal.imageVersions.getVersionInternal,
      {
        versionId: imageVersionId,
      },
    );
    if (!version || !version.prompt) {
      console.warn(
        `Image version ${imageVersionId} has no prompt. Skipping embedding.`,
      );
      return;
    }

    try {
      const embedding = await getTextEmbedding(version.prompt);
      if (embedding) {
        await ctx.runMutation(internal.media.storeImageEmbedding, {
          imageVersionId,
          embedding: embedding,
        });
      }
    } catch (error) {
      console.error(
        `Failed to generate embedding for image ${imageVersionId}`,
        error,
      );
    }
  },
});

// === 视频相关 ===
export const storeVideoEmbedding = internalMutation({
  args: {
    videoClipVersionId: v.id("videoClipVersions"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, { videoClipVersionId, embedding }) => {
    await ctx.db.patch(videoClipVersionId, { embedding });
  },
});

export const generateEmbeddingForVideo = internalAction({
  args: { videoClipVersionId: v.id("videoClipVersions") },
  handler: async (ctx, { videoClipVersionId }) => {
    const videoVersion = await ctx.runQuery(
      internal.segments.getVideoClipVersionInternal,
      { versionId: videoClipVersionId },
    );

    if (!videoVersion || !videoVersion.prompt) {
      console.warn(
        `Video clip version ${videoClipVersionId} has no prompt. Skipping embedding.`,
      );
      return;
    }

    try {
      const embedding = await getTextEmbedding(videoVersion.prompt);
      if (embedding) {
        await ctx.runMutation(internal.media.storeVideoEmbedding, {
          videoClipVersionId,
          embedding: embedding,
        });
      }
    } catch (error) {
      console.error(
        `Failed to generate embedding for video ${videoClipVersionId}`,
        error,
      );
    }
  },
});

async function translateToEnglishIfNeeded(text: string): Promise<string> {
  // 使用正则表达式检测中文字符
  if (!/[\u4e00-\u9fa5]/.test(text)) {
    return text; // 如果不包含中文，直接返回原文
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert translator. Your task is to translate the given text into English. Respond with only the English translation, without any explanations or quotation marks.",
        },
        { role: "user", content: text },
      ],
      temperature: 0,
    });
    return completion.choices[0]?.message?.content ?? text;
  } catch (error) {
    console.error("Failed to translate search text, using original.", error);
    return text; // 翻译失败则使用原文
  }
}

// === 搜索功能 (最终修正版) ===

export const getBatchOfImages = internalQuery({
  args: { ids: v.array(v.id("imageVersions")) },
  handler: async (ctx, { ids }) => {
    const records = await Promise.all(ids.map((id) => ctx.db.get(id)));
    const nonNullRecords = records.filter(Boolean) as Doc<"imageVersions">[];
    return await Promise.all(
      nonNullRecords.map(async (record) => {
        const previewUrl = await ctx.storage.getUrl(record.previewImage);
        return {
          resultType: "image" as const,
          ...record,
          previewUrl,
        };
      }),
    );
  },
});

export const getBatchOfVideos = internalQuery({
  args: { ids: v.array(v.id("videoClipVersions")) },
  handler: async (ctx, { ids }) => {
    const records = await Promise.all(ids.map((id) => ctx.db.get(id)));
    const nonNullRecords = records.filter(
      Boolean,
    ) as Doc<"videoClipVersions">[];
    return await Promise.all(
      nonNullRecords.map(async (record) => {
        const videoUrl = record.storageId
          ? await ctx.storage.getUrl(record.storageId)
          : null;
        const sourceImage = record.sourceImageVersionId
          ? await ctx.db.get(record.sourceImageVersionId)
          : null;
        const previewUrl = sourceImage
          ? await ctx.storage.getUrl(sourceImage.previewImage)
          : null;
        return {
          resultType: "video" as const,
          ...record,
          previewUrl,
          videoUrl,
        };
      }),
    );
  },
});

export const getRecentMedia = internalQuery({
  // 它现在直接接收正确的、数据库内部的用户ID
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<SearchResult[]> => {
    // 无需任何转换，直接使用 ID 进行查询
    const [images, videos] = await Promise.all([
      ctx.db
        .query("imageVersions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(10),
      ctx.db
        .query("videoClipVersions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(10),
    ]);

    // (处理并返回数据的逻辑保持不变)
    const imagesWithData: ImageSearchResult[] = await Promise.all(
      images.map(async (record) => {
        const previewUrl = await ctx.storage.getUrl(record.previewImage);
        return {
          ...record,
          resultType: "image" as const,
          previewUrl,
          _score: 0,
        };
      }),
    );
    const videosWithData: VideoSearchResult[] = await Promise.all(
      videos.map(async (record) => {
        const videoUrl = record.storageId
          ? await ctx.storage.getUrl(record.storageId)
          : null;
        const sourceImage = record.sourceImageVersionId
          ? await ctx.db.get(record.sourceImageVersionId)
          : null;
        const previewUrl = sourceImage
          ? await ctx.storage.getUrl(sourceImage.previewImage)
          : null;
        return {
          ...record,
          resultType: "video" as const,
          previewUrl,
          videoUrl,
          _score: 0,
        };
      }),
    );
    const combined: SearchResult[] = [...imagesWithData, ...videosWithData];
    combined.sort((a, b) => b._creationTime - a._creationTime);
    return combined.slice(0, 20);
  },
});

// 用这个最终简化的版本替换现有的 searchMedia 函数
export const searchMedia = action({
  args: {
    searchText: v.optional(v.string()),
  },
  handler: async (
    ctx: ActionCtx,
    { searchText }: { searchText?: string },
  ): Promise<SearchResult[]> => {
    // 步骤 1: 获取真正的数据库用户ID (Id<"users"> | null)
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    if (searchText) {
      // 3. 在搜索前，先进行翻译
      const englishSearchText = await translateToEnglishIfNeeded(searchText);
      console.log(
        `Original search: "${searchText}", Translated to: "${englishSearchText}"`,
      );

      // 步骤 2: 对于 vectorSearch，使用字符串ID进行过滤
      const queryEmbedding = await getTextEmbedding(englishSearchText);
      if (!queryEmbedding) return [];

      const userIdString = userId.toString(); // 转换为纯字符串

      const [imageHits, videoHits] = await Promise.all([
        ctx.vectorSearch("imageVersions", "by_embedding", {
          vector: queryEmbedding,
          limit: 16,
          filter: (q) => q.eq("userIdString", userIdString), // 使用新字段过滤
        }),
        ctx.vectorSearch("videoClipVersions", "by_embedding", {
          vector: queryEmbedding,
          limit: 16,
          filter: (q) => q.eq("userIdString", userIdString), // 使用新字段过滤
        }),
      ]);

      const SCORE_THRESHOLD = 0.85;

      const filteredImageHits = imageHits.filter(
        (hit) => hit._score > SCORE_THRESHOLD,
      );
      const filteredVideoHits = videoHits.filter(
        (hit) => hit._score > SCORE_THRESHOLD,
      );

      const imageIds = filteredImageHits.map((h) => h._id);
      const videoIds = filteredVideoHits.map((h) => h._id);

      const [images, videos] = await Promise.all([
        ctx.runQuery(internal.media.getBatchOfImages, { ids: imageIds }),
        ctx.runQuery(internal.media.getBatchOfVideos, { ids: videoIds }),
      ]);
      const imageScoreMap = new Map(
        filteredImageHits.map((hit) => [hit._id, hit._score]),
      );
      const videoScoreMap = new Map(
        filteredVideoHits.map((hit) => [hit._id, hit._score]),
      );
      const scoredImages: ImageSearchResult[] = images.map((img) => ({
        ...img,
        _score: imageScoreMap.get(img._id)!,
      }));
      const scoredVideos: VideoSearchResult[] = videos.map((vid) => ({
        ...vid,
        _score: videoScoreMap.get(vid._id)!,
      }));
      const combinedResults: SearchResult[] = [
        ...scoredImages,
        ...scoredVideos,
      ];
      combinedResults.sort((a, b) => b._score - a._score);
      return combinedResults.slice(0, 20);
    } else {
      // 步骤 3: 当没有搜索词时，直接把这个 ID 传给 getRecentMedia
      return await ctx.runQuery(internal.media.getRecentMedia, { userId });
    }
  },
});
