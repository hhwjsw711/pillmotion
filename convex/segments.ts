import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  CREDIT_COSTS,
  videoClipGenerationStatusValidator,
  videoClipTypeValidator,
} from "./schema";
import OpenAI from "openai";
import { Doc, Id } from "./_generated/dataModel";
import { consumeCreditsHelper } from "./credits";
import { verifySegmentOwner, verifyStoryOwner } from "./lib/auth";

const openai = new OpenAI();

export const createSegment = internalMutation({
  args: {
    storyId: v.id("story"),
    text: v.string(),
    order: v.number(),
  },
  async handler(ctx, args) {
    return await ctx.db.insert("segments", {
      storyId: args.storyId,
      text: args.text,
      order: args.order,
      isGenerating: false,
    });
  },
});

export const updateSegmentStatus = internalMutation({
  args: {
    segmentId: v.id("segments"),
    isGenerating: v.optional(v.boolean()),
    error: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const { segmentId, ...rest } = args;
    await ctx.db.patch(segmentId, rest);
  },
});

export const updateSegmentText = mutation({
  args: {
    segmentId: v.id("segments"),
    text: v.string(),
  },
  async handler(ctx, args) {
    await verifySegmentOwner(ctx, args.segmentId);
    await ctx.db.patch(args.segmentId, { text: args.text });
  },
});

export const deleteSegment = mutation({
  args: { segmentId: v.id("segments") },
  handler: async (ctx, { segmentId }) => {
    const { segment: segmentToDelete } = await verifySegmentOwner(
      ctx,
      segmentId,
    );

    // 步骤 1: 并发获取所有相关的文档
    const [imageVersions, videoClipVersions] = await Promise.all([
      ctx.db
        .query("imageVersions")
        .withIndex("by_segment", (q) => q.eq("segmentId", segmentId))
        .collect(),
      ctx.db
        .query("videoClipVersions")
        .withIndex("by_segment", (q) => q.eq("segmentId", segmentId))
        .collect(),
    ]);

    // 步骤 2: 聚合所有删除操作到一个类型兼容的数组中
    const deletionPromises: Promise<void | null>[] = [];

    for (const version of imageVersions) {
      if (version.image) {
        deletionPromises.push(ctx.storage.delete(version.image));
      }
      if (version.previewImage) {
        deletionPromises.push(ctx.storage.delete(version.previewImage));
      }
      deletionPromises.push(ctx.db.delete(version._id));
    }

    for (const clip of videoClipVersions) {
      if (clip.storageId) {
        deletionPromises.push(ctx.storage.delete(clip.storageId));
      }
      deletionPromises.push(ctx.db.delete(clip._id));
    }

    // 将 segment 本身加入删除队列
    deletionPromises.push(ctx.db.delete(segmentId));

    // 步骤 3: 并行执行所有删除。
    // Convex mutation 是事务性的, 所以这是一个“全有或全无”的操作。
    await Promise.all(deletionPromises);

    // 步骤 4: 重新排序后续的 segments
    const subsequentSegments = await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) =>
        q.eq("storyId", segmentToDelete.storyId),
      )
      .filter((q) => q.gt(q.field("order"), segmentToDelete.order))
      .order("asc")
      .collect();

    // 在一个事务中更新所有后续 segment 的 order
    await Promise.all(
      subsequentSegments.map((segment) =>
        ctx.db.patch(segment._id, { order: segment.order - 1 }),
      ),
    );

    // 步骤 5: 更新故事的封面图
    await ctx.scheduler.runAfter(
      0,
      internal.story.internalUpdateStoryThumbnail,
      {
        storyId: segmentToDelete.storyId,
      },
    );
  },
});

export const getSegmentInternal = internalQuery({
  args: { segmentId: v.id("segments") },
  async handler(ctx, args) {
    return await ctx.db.get(args.segmentId);
  },
});

export const getSegments = internalQuery({
  args: { storyId: v.id("story") },
  async handler(ctx, args) {
    return await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) => q.eq("storyId", args.storyId))
      .order("asc")
      .collect();
  },
});

export const getVideoClipVersionInternal = internalQuery({
  args: { versionId: v.id("videoClipVersions") },
  async handler(ctx, { versionId }) {
    return await ctx.db.get(versionId);
  },
});

export const createVideoClipVersion = internalMutation({
  args: {
    type: videoClipTypeValidator,
    segmentId: v.id("segments"),
    userId: v.id("users"),
    sourceImageVersionId: v.optional(v.id("imageVersions")),
    endImageVersionId: v.optional(v.id("imageVersions")),
    generationStatus: videoClipGenerationStatusValidator,
    // --- Optional fields that might be added later by the generation task ---
    videoVersionId: v.optional(v.id("videoVersions")),
    storageId: v.optional(v.id("_storage")),
    prompt: v.optional(v.string()),
    statusMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("videoClipVersions", {
      type: args.type,
      segmentId: args.segmentId,
      userId: args.userId,
      userIdString: args.userId, // 新增：将 Id 自动转换为 string
      sourceImageVersionId: args.sourceImageVersionId,
      endImageVersionId: args.endImageVersionId,
      generationStatus: args.generationStatus,
      videoVersionId: args.videoVersionId,
      storageId: args.storageId,
      prompt: args.prompt,
      statusMessage: args.statusMessage,
      source: "ai_generated",
      // Initialize other optional fields
      processingStatus: "idle",
    });
  },
});

export const updateVideoClipVersion = internalMutation({
  args: {
    videoClipVersionId: v.id("videoClipVersions"),
    storageId: v.optional(v.id("_storage")),
    generationStatus: v.optional(videoClipGenerationStatusValidator),
    statusMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { videoClipVersionId, ...rest } = args;
    await ctx.db.patch(videoClipVersionId, rest);
  },
});

export const selectVideoClipVersion = mutation({
  args: {
    segmentId: v.id("segments"),
    videoClipVersionId: v.id("videoClipVersions"),
  },
  handler: async (ctx, { segmentId, videoClipVersionId }) => {
    // CORRECT: Public mutations MUST have authorization checks.
    await verifySegmentOwner(ctx, segmentId);

    const videoClipVersion = await ctx.db.get(videoClipVersionId);
    if (!videoClipVersion || videoClipVersion.segmentId !== segmentId) {
      throw new Error("Invalid video clip version for this segment.");
    }
    await ctx.db.patch(segmentId, {
      selectedVideoClipVersionId: videoClipVersionId,
    });
  },
});

export const internalLinkVideoToSegment = internalMutation({
  args: {
    segmentId: v.id("segments"),
    videoClipVersionId: v.id("videoClipVersions"),
  },
  handler: async (ctx, { segmentId, videoClipVersionId }) => {
    // CORRECT: Internal mutations are trusted, no auth check needed.
    // Data integrity check is still a good practice.
    const videoClipVersion = await ctx.db.get(videoClipVersionId);
    if (!videoClipVersion || videoClipVersion.segmentId !== segmentId) {
      throw new Error("Invalid video clip version for this segment.");
    }
    await ctx.db.patch(segmentId, {
      selectedVideoClipVersionId: videoClipVersionId,
    });
  },
});

export const getVideoClipGenerationData = internalQuery({
  args: {
    segmentId: v.id("segments"),
    imageVersionId: v.id("imageVersions"),
  },
  handler: async (ctx, { segmentId, imageVersionId }) => {
    const segment = await ctx.db.get(segmentId);
    if (!segment) throw new Error("Segment not found");

    const imageVersion = await ctx.db.get(imageVersionId);
    if (!imageVersion) throw new Error("Image version not found");

    if (imageVersion.segmentId !== segmentId) {
      throw new Error(
        "Image version does not belong to the specified segment.",
      );
    }

    const story = await ctx.db.get(segment.storyId);
    if (!story) throw new Error("Story not found for segment");

    return {
      userId: story.userId,
      segmentText: segment.text,
      imageVersion: imageVersion,
      storyStyle: story.stylePrompt,
    };
  },
});

export const getSegmentEditorData = query({
  args: { segmentId: v.id("segments") },
  handler: async (ctx, args) => {
    const segment = await ctx.db.get(args.segmentId);
    if (!segment) {
      return null;
    }

    await verifyStoryOwner(ctx, segment.storyId);

    // 1. 获取所有图片版本
    const imageVersions = await ctx.db
      .query("imageVersions")
      .withIndex("by_segment", (q) => q.eq("segmentId", args.segmentId))
      .order("desc")
      .collect();

    // 2. 获取所有视频片段版本
    const videoClipVersions = await ctx.db
      .query("videoClipVersions")
      .withIndex("by_segment", (q) => q.eq("segmentId", args.segmentId))
      .order("desc")
      .collect();

    // 3. 将视频版本按其源图片ID进行分组
    const videoVersionsBySourceImage = videoClipVersions.reduce(
      (acc, videoVersion) => {
        const sourceId = videoVersion.sourceImageVersionId;
        if (sourceId) {
          if (!acc[sourceId]) {
            acc[sourceId] = [];
          }
          acc[sourceId].push(videoVersion);
        }
        return acc;
      },
      {} as Record<Id<"imageVersions">, Doc<"videoClipVersions">[]>,
    );

    // 4. 为图片版本附加URL和其子视频版本
    const imageVersionsWithData = await Promise.all(
      imageVersions.map(async (version) => {
        const [imageUrl, previewImageUrl] = await Promise.all([
          version.image ? ctx.storage.getUrl(version.image) : null,
          version.previewImage
            ? ctx.storage.getUrl(version.previewImage)
            : null,
        ]);
        return {
          ...version,
          imageUrl,
          previewImageUrl,
          videoSubVersions: videoVersionsBySourceImage[version._id] ?? [],
        };
      }),
    );

    // 5. 获取当前主预览区需要显示的视频URL（逻辑保持，但数据源改变）
    let mainDisplayVideo = null;
    if (segment.selectedVideoClipVersionId) {
      const videoClipVersion = videoClipVersions.find(
        (v) => v._id === segment.selectedVideoClipVersionId,
      );
      if (videoClipVersion?.storageId) {
        const url = await ctx.storage.getUrl(videoClipVersion.storageId);
        mainDisplayVideo = {
          ...videoClipVersion,
          url,
        };
      }
    }

    // 6. 获取当前主预览区需要显示的图片URL
    let mainDisplayImage = null;
    if (segment.selectedVersionId) {
      const imageVersion = imageVersionsWithData.find(
        (v) => v._id === segment.selectedVersionId,
      );
      if (imageVersion?.imageUrl) {
        mainDisplayImage = {
          ...imageVersion,
          url: imageVersion.imageUrl,
        };
      }
    }

    return {
      segment,
      imageVersions: imageVersionsWithData,
      videoClip: mainDisplayVideo,
      image: mainDisplayImage,
    };
  },
});

export const generateAndCreateSegment = internalAction({
  args: {
    userId: v.id("users"),
    storyId: v.id("story"),
    text: v.string(),
    order: v.number(),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    let segmentId: Id<"segments"> | null = null;
    try {
      segmentId = await ctx.runMutation(internal.segments.createSegment, {
        storyId: args.storyId,
        text: args.text,
        order: args.order,
      });

      await ctx.runMutation(internal.segments.updateSegmentStatus, {
        segmentId,
        isGenerating: true,
      });

      await ctx.runMutation(internal.credits.consumeCredits, {
        userId: args.userId,
        cost: CREDIT_COSTS.IMAGE_GENERATION,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: getSystemPrompt(args.context) },
          { role: "user", content: args.text },
        ],
        response_format: { type: "json_object" },
      });
      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error("OpenAI did not return content for prompt generation.");
      }
      const prompt = JSON.parse(content).prompt;

      const imageGenerationSuccess = await ctx.runAction(
        internal.replicate.regenerateSegmentImageUsingPrompt,
        {
          segmentId,
          prompt,
        },
      );

      // Check the result from the sub-action.
      if (!imageGenerationSuccess) {
        // If the sub-action failed, we propagate the failure upwards.
        // The detailed error is already set on the segment in the sub-action.
        return { success: false, error: "Image generation sub-task failed." };
      }

      // Only return success if the image generation was also successful.
      return { success: true };
    } catch (error: any) {
      console.error("Failed to generate segment:", error);
      if (segmentId) {
        await ctx.runMutation(internal.segments.updateSegmentStatus, {
          segmentId,
          isGenerating: false,
          error: error.message || "Unknown error",
        });
      }
      return { success: false, error: error.message };
    }
  },
});

function getSystemPrompt(context?: string) {
  const defaultStyle = "A vibrant, cinematic anime style.";
  const contextString =
    context || `{"style_bible": {"visual_theme": "${defaultStyle}"}}`;

  // Dynamically add keywords based on the style guide
  let dynamicKeywords = "";
  try {
    const parsedContext = JSON.parse(contextString);
    const theme = parsedContext?.style_bible?.visual_theme?.toLowerCase() || "";
    if (theme.includes("cinematic")) {
      dynamicKeywords +=
        ", cinematic lighting, epic composition, ultra-detailed, film grain, anamorphic lens flare";
    }
    if (theme.includes("anime") || theme.includes("animation")) {
      dynamicKeywords +=
        ", trending on pixiv, studio ghibli style, clean line art";
    }
    if (theme.includes("photo")) {
      dynamicKeywords += ", photorealistic, 8k, sharp focus, f/1.8";
    }
  } catch (e) {
    // Ignore parsing errors, just use the default
  }

  return `You are an expert prompt engineer for text-to-image models. Your mission is to generate a high-quality, detailed image prompt **IN ENGLISH**.

You will be given a "Style Bible" and a "Scene Description". Both might be in a language other than English. You must first understand their meaning and then synthesize them into a single, cohesive, and descriptive prompt for an image generation model.

**IMPORTANT RULES**:
1.  **Output Language**: The final output prompt inside the JSON object MUST be in **ENGLISH**.
2.  **Synthesize, Don't Just Translate**: Do not just literally translate the words. Understand the artistic direction from the Style Bible and the narrative moment from the Scene Description, and combine them into a powerful visual instruction.
3.  **Technical Details**: Incorporate advanced photographic and artistic terms. Start with the core description, then append stylistic keywords.
4.  **Adherence**: Strictly adhere to the visual and thematic elements described in the Style Bible.
5.  **Final Prompt Structure**: The final prompt should be a series of descriptive phrases, separated by commas. It should incorporate these dynamic keywords: "${dynamicKeywords}".
6.  **Output Format**: Respond with ONLY a single JSON object with one key: "prompt". The value of "prompt" should be the final, English-language image prompt.

**STYLE BIBLE (JSON)**:
${contextString}

**SCENE DESCRIPTION (Text)**:
The scene to illustrate will be provided in the user message.
`;
}

export const getByStory = query({
  args: { storyId: v.id("story") },
  async handler(ctx, args) {
    try {
      await verifyStoryOwner(ctx, args.storyId);
    } catch (error) {
      // On auth failure, we can silently return an empty array
      // as the user shouldn't see any segments.
      return [];
    }

    // 1. Fetch all segments for the story, ordered correctly.
    const segments = await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) => q.eq("storyId", args.storyId))
      .collect();

    // 2. Extract all unique, valid version IDs.
    const versionIds = [
      ...new Set(segments.map((s) => s.selectedVersionId).filter(Boolean)),
    ] as Id<"imageVersions">[];

    // 3. Fetch all corresponding image versions in a single query.
    let versionsById = new Map<Id<"imageVersions">, Doc<"imageVersions">>();
    if (versionIds.length > 0) {
      const versions = await ctx.db
        .query("imageVersions")
        .filter((q) =>
          q.or(...versionIds.map((id) => q.eq(q.field("_id"), id))),
        )
        .collect();
      versionsById = new Map(versions.map((v) => [v._id, v]));
    }

    // 4. Map over segments to construct the final result, including the pre-signed URL.
    const results = await Promise.all(
      segments.map(async (segment) => {
        const selectedVersion = segment.selectedVersionId
          ? (versionsById.get(segment.selectedVersionId) ?? null)
          : null;

        const previewImageUrl = selectedVersion?.previewImage
          ? await ctx.storage.getUrl(selectedVersion.previewImage)
          : null;

        return {
          ...segment,
          selectedVersion: selectedVersion,
          previewImageUrl: previewImageUrl,
        };
      }),
    );

    return results;
  },
});

export const reorderSegments = mutation({
  args: {
    storyId: v.id("story"),
    segmentIds: v.array(v.id("segments")),
  },
  handler: async (ctx, { storyId, segmentIds }) => {
    await verifyStoryOwner(ctx, storyId);

    // To ensure atomicity and prevent race conditions,
    // we perform all database writes sequentially without any `await` inside the loop.
    const updatePromises = segmentIds.map((segmentId, index) =>
      ctx.db.patch(segmentId, { order: index }),
    );

    // We await all the promises at the end.
    // If any patch fails, Convex will automatically roll back the entire transaction.
    await Promise.all(updatePromises);
    await ctx.scheduler.runAfter(
      0,
      internal.story.internalUpdateStoryThumbnail,
      {
        storyId,
      },
    );
  },
});

export const addSegment = mutation({
  args: { storyId: v.id("story") },
  handler: async (ctx, { storyId }) => {
    await verifyStoryOwner(ctx, storyId);

    // Find the current highest order
    const lastSegment = await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) => q.eq("storyId", storyId))
      .order("desc")
      .first();

    const newOrder = lastSegment ? lastSegment.order + 1 : 0;

    // Insert the new segment at the end
    const newSegmentId = await ctx.db.insert("segments", {
      storyId,
      order: newOrder,
      text: "New scene...",
      isGenerating: false,
    });

    return newSegmentId;
  },
});

export const get = query({
  args: { id: v.id("segments") },
  handler: async (ctx, args) => {
    try {
      const { segment } = await verifySegmentOwner(ctx, args.id);

      const selectedVersion = segment.selectedVersionId
        ? await ctx.db.get(segment.selectedVersionId)
        : null;

      return { ...segment, selectedVersion };
    } catch (error) {
      return null;
    }
  },
});

export const regenerateImage = mutation({
  args: {
    segmentId: v.id("segments"),
    prompt: v.string(),
  },
  async handler(ctx, args) {
    const { userId } = await verifySegmentOwner(ctx, args.segmentId);
    await consumeCreditsHelper(ctx, userId, CREDIT_COSTS.IMAGE_GENERATION);

    await ctx.db.patch(args.segmentId, {
      isGenerating: true,
      error: undefined,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.replicate.regenerateSegmentImageUsingPrompt,
      {
        segmentId: args.segmentId,
        prompt: args.prompt,
      },
    );
  },
});

export const editImage = mutation({
  args: {
    segmentId: v.id("segments"),
    prompt: v.string(),
    versionIdToEdit: v.id("imageVersions"),
  },
  async handler(ctx, args) {
    const { userId } = await verifySegmentOwner(ctx, args.segmentId);

    const versionToEdit = await ctx.db.get(args.versionIdToEdit);
    if (!versionToEdit || versionToEdit.segmentId !== args.segmentId) {
      throw new Error("Version to edit is not valid for this segment.");
    }

    await consumeCreditsHelper(ctx, userId, CREDIT_COSTS.IMAGE_GENERATION);

    await ctx.db.patch(args.segmentId, {
      isGenerating: true,
      error: undefined,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.replicate.editSegmentImageUsingPrompt,
      {
        segmentId: args.segmentId,
        newInstruction: args.prompt,
        versionIdToEdit: args.versionIdToEdit,
        originalPrompt: versionToEdit.prompt,
      },
    );
  },
});

export const generateVideoClipForSegment = mutation({
  args: {
    type: v.literal("image-to-video"),
    imageVersionId: v.id("imageVersions"),
  },
  handler: async (ctx, args) => {
    const imageVersion = await ctx.db.get(args.imageVersionId);
    if (!imageVersion || !imageVersion.segmentId) {
      throw new Error("Image version not found or not linked to a segment.");
    }

    const { userId } = await verifySegmentOwner(ctx, imageVersion.segmentId);

    await consumeCreditsHelper(ctx, userId, CREDIT_COSTS.VIDEO_CLIP_GENERATION);

    // 不再在这里创建 videoClipVersion 记录。
    // 将所有生成逻辑委托给 action。
    await ctx.scheduler.runAfter(0, internal.replicate.generateVideoClip, {
      segmentId: imageVersion.segmentId,
      imageVersionId: args.imageVersionId,
      // 注意：这里不传递 videoVersionId，因为这是一个独立的片段生成任务。
    });
  },
});
