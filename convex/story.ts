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
import { Doc } from "./_generated/dataModel";

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

export const updateBgmUrl = mutation({
  args: {
    storyId: v.id("story"),
    bgmUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyStoryOwner(ctx, args.storyId);
    await ctx.db.patch(args.storyId, {
      bgmUrl: args.bgmUrl,
      updatedAt: Date.now(),
    });
  },
});

export const listPublic = query({
  handler: async (ctx) => {
    const stories = await ctx.db
      .query("story")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("desc")
      .collect();
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
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new ConvexError("Story not found.");
    }
    if (story.status === "published") {
      return story;
    }
    const { story: verifiedStory } = await verifyStoryOwner(ctx, args.storyId);
    return verifiedStory;
  },
});

export const updateStatus = mutation({
  args: {
    storyId: v.id("story"),
    status: storyStatusValidator,
  },
  handler: async (ctx, args) => {
    await verifyStoryOwner(ctx, args.storyId);
    await ctx.db.patch(args.storyId, {
      status: args.status,
      updatedAt: Date.now(),
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
    await verifyStoryOwner(ctx, args.storyId);
    const segments = await ctx.db
      .query("segments")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .collect();

    for (const segment of segments) {
      const imageVersions = await ctx.db
        .query("imageVersions")
        .withIndex("by_segment", (q) => q.eq("segmentId", segment._id))
        .collect();

      for (const version of imageVersions) {
        if (version.image) await ctx.storage.delete(version.image);
        if (version.previewImage)
          await ctx.storage.delete(version.previewImage);
        await ctx.db.delete(version._id);
      }
      await ctx.db.delete(segment._id);
    }
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
    const { userId } = await verifyStoryOwner(ctx, storyId);
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

    const videoVersionId = await ctx.db.insert("videoVersions", {
      storyId: storyId,
      userId: userId,
      source: "ai_generated",
      generationStatus: "pending",
      generationId: generationId,
    });

    await ctx.db.patch(storyId, {
      selectedVideoVersionId: videoVersionId,
    });

    await ctx.scheduler.runAfter(0, internal.story.generateVideoOrchestrator, {
      storyId,
      videoVersionId,
    });

    return videoVersionId;
  },
});

/**
 * [FIXED] This orchestrator now calls the new, correct `generateImageToVideoClip` action
 * and provides all the necessary arguments like `userId` and `generationId`.
 */
export const generateVideoOrchestrator = internalAction({
  args: {
    storyId: v.id("story"),
    videoVersionId: v.id("videoVersions"),
  },
  handler: async (ctx, { storyId, videoVersionId }) => {
    await ctx.runMutation(internal.story.updateVideoVersionStatus, {
      videoVersionId,
      status: "generating_clips",
    });

    try {
      const videoVersion = await ctx.runQuery(
        internal.story.getVideoVersionInternal,
        { id: videoVersionId },
      );
      if (!videoVersion || !videoVersion.generationId) {
        throw new Error(
          `Video version ${videoVersionId} not found or has no generationId.`,
        );
      }
      const { generationId, userId } = videoVersion;

      const segments = await ctx.runQuery(internal.segments.getSegments, {
        storyId,
      });

      if (segments.length === 0) {
        await ctx.runMutation(internal.story.updateVideoVersionStatus, {
          videoVersionId,
          status: "error",
          statusMessage: "Story has no segments to generate video from.",
        });
        return;
      }

      const clipGenerationPromises = segments.map((segment) => {
        // =================================================================
        // >> [NEW] The "Smart Check" is here!
        // =================================================================
        // If this segment ALREADY has a selected video clip, we skip it.
        if (segment.selectedVideoClipVersionId) {
          console.log(
            `Segment ${segment._id} already has a video clip, skipping generation.`,
          );
          // We must return a resolved promise with a success state
          // so that `Promise.all` works correctly.
          return Promise.resolve({ success: true });
        }
        // =================================================================

        if (!segment.selectedVersionId) {
          console.error(
            `Segment ${segment._id} has no selected image, skipping.`,
          );
          return Promise.resolve({
            success: false,
            error: "No image selected",
          });
        }

        const imageVersionId = segment.selectedVersionId;

        return ctx
          .runMutation(internal.segments.updateSegmentStatus, {
            segmentId: segment._id,
            isGenerating: true,
          })
          .then(() =>
            ctx.runAction(internal.replicate.generateImageToVideoClip, {
              segmentId: segment._id,
              imageVersionId: imageVersionId,
              userId: userId,
              generationId: generationId,
            }),
          )
          .then(() => ({ success: true }))
          .catch((error) => {
            console.error(
              `Clip generation failed for segment ${segment._id}:`,
              error,
            );
            return { success: false, error: error.message };
          });
      });

      const clipGenerationResults = await Promise.all(clipGenerationPromises);
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
        await ctx.runMutation(internal.story.updateVideoVersionStatus, {
          videoVersionId,
          status: "generated",
          statusMessage:
            "All clips generated. Ready for review and manual stitching.",
        });
      }
    } catch (error: any) {
      console.error(
        `Video orchestrator failed for video version ${videoVersionId}:`,
        error,
      );
      await ctx.runMutation(internal.story.updateVideoVersionStatus, {
        videoVersionId,
        status: "error",
        statusMessage: error.message,
      });
    }
  },
});

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
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert film editor. Your task is to read a story script and break it down into a sequence of distinct scenes. Each scene should be a self-contained, visually coherent moment. Preserve the original wording. Output the result as a single JSON object with a single key "scenes", which contains an array of strings. Do not output anything else.
Example Input: "A princess lived in a castle. One day, she ran into the dark forest."
Example Output: { "scenes": ["A princess lived in a castle.", "One day, she ran into the dark forest."] }`,
        },
        { role: "user", content: script },
      ],
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0].message.content;
    if (!content) {
      console.error("AI did not return content for script splitting.");
      return [script];
    }
    const result = JSON.parse(content);
    if (result.scenes && Array.isArray(result.scenes)) {
      return result.scenes.filter(
        (scene: unknown) => typeof scene === "string" && scene.trim() !== "",
      );
    }
    console.error("AI response did not match expected format:", result);
    return [script];
  } catch (error) {
    console.error("Failed to split script using AI:", error);
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
      if (story.script.includes("\n\n")) {
        segments = story.script.split(/\n{2,}/).filter((s) => s.trim() !== "");
      } else {
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
        console.log(
          `Orchestrator (genId: ${generationId}) is obsolete. Aborting.`,
        );
        return;
      }

      const hasErrors = results.some((r) => !r.success);
      await ctx.runMutation(internal.story.updateStoryGenerationStatus, {
        storyId,
        status: hasErrors ? "error" : "completed",
      });
    } catch (error: any) {
      console.error(
        `Orchestrator (genId: ${generationId}) failed for story ${storyId}:`,
        error,
      );
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
        content: `You are a top-tier showrunner. Analyze the provided script and generate a "Production Bible" in a single JSON object. The JSON object MUST contain exactly two top-level keys: "story_outline" (a one-paragraph summary) and "style_bible" (an object with keys: "visual_theme", "mood", "color_palette", "lighting_style", "character_design", "environment_design"). The entire output must be in the detected language of the script. Do not output anything besides this single JSON object.`,
      },
      { role: "user", content: script },
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

/**
 * [NEW] A small helper query to get a video version document by its ID.
 * This is used by the orchestrator.
 */
export const getVideoVersionInternal = internalQuery({
  args: { id: v.id("videoVersions") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
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

    if (firstSegment) {
      try {
        // [UPGRADE] Prioritize video poster for the thumbnail
        if (firstSegment.selectedVideoClipVersionId) {
          const selectedClip = await ctx.runQuery(
            internal.segments.getVideoClipVersionInternal,
            { versionId: firstSegment.selectedVideoClipVersionId },
          );
          if (selectedClip?.posterStorageId) {
            thumbnailUrl = await ctx.storage.getUrl(
              selectedClip.posterStorageId,
            );
          }
        }
        // Fallback to image preview if no video is selected or it has no poster
        else if (firstSegment.selectedVersionId) {
          const selectedVersion = await ctx.runQuery(
            internal.imageVersions.getVersionInternal,
            { versionId: firstSegment.selectedVersionId },
          );
          if (selectedVersion?.previewImage) {
            thumbnailUrl = await ctx.storage.getUrl(
              selectedVersion.previewImage,
            );
          }
        }
      } catch (e) {
        console.error(
          `Error getting URL for thumbnail for story ${storyId}`,
          e,
        );
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
    const story = await ctx.db.get(args.storyId);
    if (!story) {
      return null;
    }

    // --- [ADDITION START] ---
    // We are merging the logic from `getSegmentsWithPreview` directly into here.
    const segments = await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) => q.eq("storyId", args.storyId))
      .order("asc")
      .collect();

    const segmentsWithPreview = await Promise.all(
      segments.map(async (segment) => {
        let previewImageUrl: string | null = null;
        let posterUrl: string | null = null;
        let videoUrl: string | null = null;

        if (segment.selectedVersionId) {
          const selectedVersion = await ctx.db.get(segment.selectedVersionId);
          if (selectedVersion?.previewImage) {
            try {
              previewImageUrl = await ctx.storage.getUrl(
                selectedVersion.previewImage,
              );
            } catch (e) {
              /* Silently fail */
            }
          }
        }

        if (segment.selectedVideoClipVersionId) {
          const selectedClip = await ctx.db.get(
            segment.selectedVideoClipVersionId,
          );
          if (selectedClip) {
            try {
              const [fetchedVideoUrl, fetchedPosterUrl] = await Promise.all([
                selectedClip.storageId
                  ? ctx.storage.getUrl(selectedClip.storageId)
                  : null,
                selectedClip.posterStorageId
                  ? ctx.storage.getUrl(selectedClip.posterStorageId)
                  : null,
              ]);
              videoUrl = fetchedVideoUrl;
              posterUrl = fetchedPosterUrl;
            } catch (e) {
              /* Silently fail */
            }
          }
        }

        return {
          ...segment,
          previewImageUrl,
          posterUrl,
          videoUrl,
        };
      }),
    );
    // --- [ADDITION END] ---

    const userId = await auth.getUserId(ctx);
    let videoVersion:
      | (Doc<"videoVersions"> & { videoUrl: string | null })
      | null = null;

    if (userId && story.userId === userId) {
      if (story.selectedVideoVersionId) {
        const versionDoc = await ctx.db.get(story.selectedVideoVersionId);
        if (versionDoc) {
          const videoUrl = versionDoc.storageId
            ? await ctx.storage.getUrl(versionDoc.storageId)
            : null;
          videoVersion = { ...versionDoc, videoUrl };
        }
      }
    }

    return {
      story: { ...story, segmentCount: segments.length },
      // [MODIFICATION] Return the segments along with the story data
      segments: segmentsWithPreview,
      videoVersion,
    };
  },
});
