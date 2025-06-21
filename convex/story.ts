import {
  mutation,
  query,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { prosemirrorSync } from "./prosemirror";
import { auth } from "./auth";
import { ConvexError, v } from "convex/values";
import {
  storyFormatValidator,
  storyStatusValidator,
  CREDIT_COSTS,
  storyGenerationStatusValidator,
  storyVideoGenerationStatusValidator,
} from "./schema";
import { internal } from "./_generated/api";
import { consumeCreditsHelper } from "./credits";
import OpenAI from "openai";
import { nanoid } from "nanoid";
import { verifyStoryOwner } from "./lib/auth";

const openai = new OpenAI();

export const updateStoryTitle = mutation({
  args: {
    storyId: v.id("story"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyStoryOwner(ctx, args.storyId);
    await ctx.db.patch(args.storyId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

/**
 * NEW: A public query to list all published stories from all users.
 * This does not require authentication.
 */
export const listPublic = query({
  handler: async (ctx) => {
    const stories = await ctx.db
      .query("story")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("desc")
      .collect();

    // The N+1 query problem is solved!
    // We can now return the stories directly as they already contain the `thumbnailUrl`.
    return stories;
  },
});

export const list = query({
  args: {
    status: v.optional(storyStatusValidator),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    let queryBuilder;
    if (args.status) {
      queryBuilder = ctx.db
        .query("story")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", args.status!),
        );
    } else {
      queryBuilder = ctx.db
        .query("story")
        .withIndex("userId", (q) => q.eq("userId", userId));
    }

    const stories = await queryBuilder.order("desc").collect();

    // The N+1 query problem is solved!
    // We can now return the stories directly as they already contain the `thumbnailUrl`.
    return stories;
  },
});

export const createStory = mutation({
  args: {
    title: v.string(),
    script: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized operation");
    }

    const storyId = await ctx.db.insert("story", {
      updatedAt: Date.now(),
      userId,
      title: args.title,
      script: args.script ?? "",
      status: "draft",
      generationStatus: "idle",
      thumbnailUrl: null,
    });

    return storyId;
  },
});

export const initializeEditor = mutation({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    const { story } = await verifyStoryOwner(ctx, args.storyId);

    const scriptText = story.script || "";
    const paragraphs = scriptText
      .split("\n")
      .filter((p) => p.trim() !== "")
      .map((pText) => ({
        type: "paragraph",
        content: [{ type: "text", text: pText }],
      }));

    const initialContent =
      paragraphs.length > 0 ? paragraphs : [{ type: "paragraph", content: [] }];

    await prosemirrorSync.create(ctx, args.storyId, {
      type: "doc",
      content: initialContent,
    });
  },
});

export const getStory = query({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    // First, get the story without any auth checks.
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new ConvexError("Story not found.");
    }

    // If the story is published, anyone can view it.
    if (story.status === "published") {
      return story;
    }

    // For any other status (draft, archived, etc.), we MUST verify ownership.
    const { story: verifiedStory } = await verifyStoryOwner(ctx, args.storyId);
    return verifiedStory;
  },
});

/**
 * NEW: A mutation to update the status of a story (e.g., to 'published').
 */
export const updateStatus = mutation({
  args: {
    storyId: v.id("story"),
    status: storyStatusValidator, // Use the validator from schema.ts
  },
  handler: async (ctx, args) => {
    // First, verify the user owns the story.
    await verifyStoryOwner(ctx, args.storyId);

    // Now, patch the document with the new status.
    await ctx.db.patch(args.storyId, {
      status: args.status,
      updatedAt: Date.now(), // Also update the 'updatedAt' timestamp.
    });
  },
});

export const updateStylePrompt = mutation({
  args: {
    storyId: v.id("story"),
    stylePrompt: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyStoryOwner(ctx, args.storyId);
    await ctx.db.patch(args.storyId, {
      stylePrompt: args.stylePrompt,
      updatedAt: Date.now(),
    });
  },
});

export const deleteStory = mutation({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    // 1. Verify ownership. This will throw an error if the user is not the owner.
    await verifyStoryOwner(ctx, args.storyId);

    // 2. Get all segments for the story using the correct index name "by_story".
    const segments = await ctx.db
      .query("segments")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .collect();

    // 3. Iterate through segments to delete related data
    for (const segment of segments) {
      // 3a. Get all image versions for the segment using the correct index name "by_segment".
      const imageVersions = await ctx.db
        .query("imageVersions")
        .withIndex("by_segment", (q) => q.eq("segmentId", segment._id))
        .collect();

      // 3b. Delete associated files from storage and the image version documents
      // using the correct field names "image" and "previewImage".
      for (const version of imageVersions) {
        if (version.image) {
          await ctx.storage.delete(version.image);
        }
        if (version.previewImage) {
          await ctx.storage.delete(version.previewImage);
        }
        await ctx.db.delete(version._id);
      }

      // 3c. Delete the segment document itself
      await ctx.db.delete(segment._id);
    }

    // 4. Finally, delete the story document
    await ctx.db.delete(args.storyId);
  },
});

export const generateSegments = mutation({
  args: {
    storyId: v.id("story"),
    format: storyFormatValidator,
  },
  handler: async (ctx, args) => {
    const { storyId, format } = args;
    const { userId } = await verifyStoryOwner(ctx, storyId);

    const generationId = nanoid();

    await ctx.db.patch(storyId, {
      format,
      generationStatus: "processing",
      generationId: generationId,
    });
    await consumeCreditsHelper(ctx, userId, CREDIT_COSTS.CHAT_COMPLETION);

    await ctx.scheduler.runAfter(0, internal.story.generateStoryOrchestrator, {
      storyId,
      userId: userId,
      generationId: generationId,
    });
  },
});

export const generateVideo = mutation({
  args: {
    storyId: v.id("story"),
  },
  handler: async (ctx, { storyId }) => {
    // 1. 验证用户权限，确保是故事的所有者
    const { userId } = await verifyStoryOwner(ctx, storyId);

    // 2. 为这次生成创建一个唯一的 ID
    const generationId = nanoid();

    const segments = await ctx.db
      .query("segments")
      .withIndex("by_story", (q) => q.eq("storyId", storyId))
      .collect();

    if (segments.length === 0) {
      throw new ConvexError("This story has no scenes to generate video from.");
    }
    const totalCost = segments.length * CREDIT_COSTS.VIDEO_CLIP_GENERATION;

    await consumeCreditsHelper(ctx, userId, totalCost);

    // 3. 在 videoVersions 表中创建一条新的记录来代表这次生成任务
    const videoVersionId = await ctx.db.insert("videoVersions", {
      storyId: storyId,
      userId: userId,
      source: "ai_generated",
      generationStatus: "pending",
      generationId: generationId,
    });

    // 4. 将 story 指向这个新创建的、正在进行的视频版本
    await ctx.db.patch(storyId, {
      selectedVideoVersionId: videoVersionId,
    });

    // 6. 调度一个后台 action 来开始真正的视频生成工作
    await ctx.scheduler.runAfter(0, internal.story.generateVideoOrchestrator, {
      storyId,
      videoVersionId,
      // TODO: 我们还需要传递其他必要的上下文信息，例如 prompt 等
    });

    // 7. 返回新创建的视频版本 ID
    return videoVersionId;
  },
});

export const generateVideoOrchestrator = internalAction({
  args: {
    storyId: v.id("story"),
    videoVersionId: v.id("videoVersions"),
  },
  handler: async (ctx, { storyId, videoVersionId }) => {
    // 1. 更新当前视频版本的状态为“正在生成片段”
    await ctx.runMutation(internal.story.updateVideoVersionStatus, {
      videoVersionId,
      status: "generating_clips",
    });

    try {
      // 2. 获取故事的所有场景
      const segments = await ctx.runQuery(internal.segments.getSegments, {
        storyId,
      });

      if (segments.length === 0) {
        // 如果没有场景，直接标记为错误或完成
        await ctx.runMutation(internal.story.updateVideoVersionStatus, {
          videoVersionId,
          status: "error",
          statusMessage: "Story has no segments to generate video from.",
        });
        return;
      }

      // 3. 为每个场景都启动一个独立的视频片段生成任务
      const clipGenerationPromises = segments.map((segment) => {
        if (!segment.selectedVersionId) {
          // 如果某个场景没有选中的图片，就返回一个失败的 promise
          console.error(
            `Segment ${segment._id} has no selected image, skipping.`,
          );
          return Promise.resolve({
            success: false,
            error: "No image selected",
          });
        }
        return ctx.runAction(internal.replicate.generateVideoClip, {
          segmentId: segment._id,
          videoVersionId: videoVersionId,
          imageVersionId: segment.selectedVersionId, // <-- 关键修正：传入 imageVersionId
        });
      });

      // 4. 等待所有片段生成任务完成
      const clipGenerationResults = await Promise.all(clipGenerationPromises);

      // 5. 检查是否有任何片段生成失败
      const hasErrors = clipGenerationResults.some((r) => !r.success);

      if (hasErrors) {
        const failedCount = clipGenerationResults.filter(
          (r) => !r.success,
        ).length;
        await ctx.runMutation(internal.story.updateVideoVersionStatus, {
          videoVersionId,
          status: "error",
          statusMessage: `${failedCount} out of ${segments.length} clips failed to generate.`,
        });
      } else {
        // 6. TODO: 暂时在这里将状态标记为完成。
        //    未来，这里将是触发“合并”操作的地方。
        await ctx.runMutation(internal.story.updateVideoVersionStatus, {
          videoVersionId,
          status: "generated",
          statusMessage:
            "All clips generated. Merging step is not yet implemented.",
        });
      }
    } catch (error: any) {
      console.error(
        `Video orchestrator failed for video version ${videoVersionId}:`,
        error,
      );
      // 出现任何未知错误，都将状态标记为失败
      await ctx.runMutation(internal.story.updateVideoVersionStatus, {
        videoVersionId,
        status: "error",
        statusMessage: error.message,
      });
    }
  },
});

// 我们需要一个新的 internalMutation 来更新 videoVersions 的状态
export const updateVideoVersionStatus = internalMutation({
  args: {
    videoVersionId: v.id("videoVersions"),
    status: storyVideoGenerationStatusValidator,
    statusMessage: v.optional(v.string()),
  },
  handler: async (ctx, { videoVersionId, status, statusMessage }) => {
    await ctx.db.patch(videoVersionId, {
      generationStatus: status,
      statusMessage: statusMessage,
    });
  },
});

async function splitScriptIntoScenes(script: string): Promise<string[]> {
  try {
    const completion = await openai.chat.completions.create({
      // You can use "gpt-4o" for potentially higher accuracy, or "gpt-4o-mini" for a balance of speed and cost.
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert film editor and script supervisor. Your task is to read a story script and break it down into a sequence of distinct scenes or 'shots'.

A scene change typically occurs when:
- The location or setting changes (e.g., from a castle to a forest).
- There is a significant jump in time (e.g., "The next day...", "Hours later...").
- A new key character enters, or a key character begins a distinct action or dialogue.
- The emotional tone or focus of the narrative shifts significantly.

Each resulting scene should be a self-contained, visually coherent moment that can be reasonably illustrated by a single image. Preserve the original wording and language of the text.

Output the result as a single JSON object with a single key "scenes", which contains an array of strings. Do not output anything else.

Example Input:
"A princess lived in a castle. One day, she ran into the dark forest. 'Where am I?' she wondered. She found a small cottage."

Example Output:
{
  "scenes": [
    "A princess lived in a castle.",
    "One day, she ran into the dark forest.",
    "'Where am I?' she wondered.",
    "She found a small cottage."
  ]
}`,
        },
        { role: "user", content: script },
      ],
      // This is crucial for ensuring the AI returns valid JSON.
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;

    // Handle cases where the AI might not respond.
    if (!content) {
      console.error("AI did not return content for script splitting.");
      return [script]; // Fallback to the original script
    }

    // Parse the JSON response from the AI.
    const result = JSON.parse(content);

    // Check if the parsed object has the 'scenes' key and it's an array.
    if (result.scenes && Array.isArray(result.scenes)) {
      // Filter out any empty strings that might have been generated.
      return result.scenes.filter(
        (scene: unknown) => typeof scene === "string" && scene.trim() !== "",
      );
    }

    console.error("AI response did not match the expected format:", result);
    return [script]; // Fallback if the format is incorrect.
  } catch (error) {
    console.error("Failed to split script using AI:", error);
    // If any error occurs (network, parsing, etc.), we fall back to the safest option.
    return [script];
  }
}

export const generateStoryOrchestrator = internalAction({
  args: {
    storyId: v.id("story"),
    userId: v.id("users"),
    generationId: v.string(),
  },
  handler: async (ctx, args) => {
    const { storyId, userId, generationId } = args;
    try {
      const story = await ctx.runQuery(internal.story.getStoryInternal, {
        storyId,
      });
      if (!story) throw new Error("Story not found");

      let segments: string[];
      // If the script from the DB contains our special separator, it means the user has made paragraphs.
      if (story.script.includes("\n\n")) {
        // We use the structure the user provided.
        segments = story.script.split(/\n{2,}/).filter((s) => s.trim() !== "");
      } else {
        // Otherwise, the user provided a single block of text. Time for the AI Editor.
        segments = await splitScriptIntoScenes(story.script);
      }

      if (segments.length === 0) {
        await ctx.runMutation(internal.story.updateStoryGenerationStatus, {
          storyId,
          status: "completed",
        });
        return;
      }

      const context = await generateContext(story.script);
      await ctx.runMutation(internal.story.updateStoryContextInternal, {
        storyId,
        context,
      });

      const segmentGenerationPromises = segments.map((text, order) =>
        ctx.runAction(internal.segments.generateAndCreateSegment, {
          storyId,
          text,
          order,
          context,
          userId,
        }),
      );

      const results = await Promise.all(segmentGenerationPromises);

      const currentStory = await ctx.runQuery(internal.story.getStoryInternal, {
        storyId,
      });

      if (currentStory?.generationId !== generationId) {
        // A new generation task has been started. This task is now obsolete.
        // We should silently exit and not update the status.
        console.log(
          `Orchestrator (genId: ${generationId}) is obsolete. Current is ${currentStory?.generationId}. Aborting final status update.`,
        );
        return;
      }

      const hasErrors = results.some((r) => !r.success);
      const finalStatus = hasErrors ? "error" : "completed";

      await ctx.runMutation(internal.story.updateStoryGenerationStatus, {
        storyId,
        status: finalStatus,
      });
    } catch (error: any) {
      console.error(
        `Orchestrator (genId: ${generationId}) failed for story ${storyId}:`,
        error,
      );
      // Ensure we mark the story as failed if the orchestrator itself fails.
      await ctx.runMutation(internal.story.updateStoryGenerationStatus, {
        storyId,
        status: "error",
      });
    }
  },
});

export const updateStoryContextInternal = internalMutation({
  args: {
    storyId: v.id("story"),
    context: v.string(),
  },
  handler: async (ctx, args) => {
    // No auth check needed here, as it's only called by trusted server code.
    await ctx.db.patch(args.storyId, { context: args.context });
  },
});

export const updateStoryGenerationStatus = internalMutation({
  args: {
    storyId: v.id("story"),
    status: storyGenerationStatusValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.storyId, { generationStatus: args.status });
  },
});

async function generateContext(script: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a top-tier showrunner for a film studio. Your task is to analyze the provided script and generate a comprehensive "Production Bible" in a single JSON object. This bible will guide all visual and narrative production.

The JSON object MUST contain exactly two top-level keys:
1.  "story_outline": A concise, one-paragraph summary of the entire plot, including the beginning, key turning points, and the ending.
2.  "style_bible": An object containing the visual style guide, which must include these keys: "visual_theme", "mood", "color_palette" (as a single comma-separated string, e.g., "bright blues, sunny yellows, coral pinks"), "lighting_style", "character_design", "environment_design".

**IMPORTANT**: First, detect the primary language of the input script. The entire "story_outline" and all values within the "style_bible" MUST be written in this detected language. This ensures consistency for our international teams.

Do not output anything besides this single, complete JSON object. If the script is too short, nonsensical, or you cannot perform the task, return a JSON object with a single key "error" containing a brief explanation.`,
      },
      {
        role: "user",
        content: script,
      },
    ],
    max_tokens: 800,
    response_format: { type: "json_object" },
  });
  const context = completion.choices[0].message.content;
  if (!context) throw new Error("Failed to generate context from OpenAI.");
  return context;
}

export const getStoryInternal = internalQuery({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.storyId);
  },
});

export const getFirstSegmentInternal = internalQuery({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) => q.eq("storyId", args.storyId))
      .order("asc")
      .first();
  },
});

export const setStoryThumbnailUrl = internalMutation({
  args: {
    storyId: v.id("story"),
    thumbnailUrl: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { storyId, thumbnailUrl }) => {
    await ctx.db.patch(storyId, { thumbnailUrl });
  },
});

export const internalUpdateStoryThumbnail = internalAction({
  args: { storyId: v.id("story") },
  handler: async (ctx, { storyId }) => {
    const firstSegment = await ctx.runQuery(
      internal.story.getFirstSegmentInternal,
      { storyId },
    );

    let thumbnailUrl: string | null = null;
    if (firstSegment?.selectedVersionId) {
      const selectedVersion = await ctx.runQuery(
        internal.imageVersions.getVersionInternal,
        { versionId: firstSegment.selectedVersionId },
      );
      if (selectedVersion?.previewImage) {
        try {
          thumbnailUrl = await ctx.storage.getUrl(selectedVersion.previewImage);
        } catch (e) {
          console.error(
            `Error getting URL for thumbnail for story ${storyId}`,
            e,
          );
        }
      }
    }
    await ctx.runMutation(internal.story.setStoryThumbnailUrl, {
      storyId,
      thumbnailUrl,
    });
  },
});

export const getStoryPageData = query({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    // We don't verify ownership here because a published story can be viewed
    // by anyone. The `getStory` logic already handles this.
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      return null;
    }

    const segments = await ctx.db
      .query("segments")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .collect();

    // However, for video data, we should probably only show it to the owner.
    // Let's verify ownership before fetching sensitive/expensive data.
    const identity = await ctx.auth.getUserIdentity();
    let videoVersion = null;
    if (identity && story.userId === identity.subject) {
      if (story.selectedVideoVersionId) {
        videoVersion = await ctx.db.get(story.selectedVideoVersionId);
      }
    }

    return {
      story: { ...story, segmentCount: segments.length },
      videoVersion,
    };
  },
});
