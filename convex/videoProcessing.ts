import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { fal } from "@fal-ai/client";
import { internal } from "./_generated/api";

// Use the Fal.ai client, unifying our AI providers
fal.config({
  credentials: process.env.FAL_KEY,
});

/**
 * [NEW] Orchestrator action to generate both first and last frame thumbnails.
 * This should be called once a video generation is successful.
 */
export const generateVideoThumbnails = internalAction({
  args: { clipId: v.id("videoClipVersions") },
  handler: async (ctx, { clipId }) => {
    // Note: We need to add a query in `convex/video.ts` to fetch this.
    // Let's assume it's `internal.video.getVideoClipVersion`.
    const clip = await ctx.runQuery(internal.video.getVideoClipVersion, {
      clipId,
    });

    if (!clip || !clip.storageId) {
      console.error(
        `[Thumbnails] Video clip or videoStorageId not found for clipId: ${clipId}`,
      );
      return;
    }

    const storageId = clip.storageId;

    // Schedule extraction for the FIRST frame (poster)
    await ctx.scheduler.runAfter(0, internal.videoProcessing.extractFrame, {
      storageId,
      frameType: "first",
      onSuccess: {
        mutation: "videoProcessing:savePoster",
        args: { clipId },
      },
      onFailure: {
        mutation: "videoProcessing:updateProcessingStatus",
        args: { clipId, processingStatus: "error" },
      },
    });

    // Schedule extraction for the LAST frame
    await ctx.scheduler.runAfter(0, internal.videoProcessing.extractFrame, {
      storageId,
      frameType: "last",
      onSuccess: {
        mutation: "videoProcessing:saveLastFramePoster",
        args: { clipId },
      },
      onFailure: {
        // Silently fail for the last frame, as it's less critical than the main poster
        mutation: "videoProcessing:logFailure",
        args: { clipId },
      },
    });
  },
});

/**
 * [EXISTING - UNCHANGED] A universal action to extract a specific frame.
 */
export const extractFrame = internalAction({
  args: {
    storageId: v.id("_storage"),
    frameType: v.union(v.literal("first"), v.literal("last")), // The key parameter!
    // Callback to run on success, passing along the new frame's storageId
    onSuccess: v.object({
      mutation: v.string(), // e.g., "videoProcessing:savePoster"
      args: v.any(),
    }),
    // Callback to run on failure
    onFailure: v.object({
      mutation: v.string(),
      args: v.any(),
    }),
  },
  handler: async (ctx, { storageId, frameType, onSuccess, onFailure }) => {
    try {
      const videoUrl = await ctx.storage.getUrl(storageId);
      if (!videoUrl) {
        throw new Error(`Could not get video URL for storageId: ${storageId}`);
      }

      const result: any = await fal.subscribe(
        "fal-ai/ffmpeg-api/extract-frame",
        {
          input: {
            video_url: videoUrl,
            frame_type: frameType, // <-- Pass the parameter directly to the AI model
          },
          logs: true,
        },
      );

      const frameUrl = result.data?.images?.[0]?.url;
      if (!frameUrl) {
        console.error("Fal.ai API response:", result);
        throw new Error("Fal.ai did not return a valid frame image URL.");
      }

      const frameResponse = await fetch(frameUrl);
      if (!frameResponse.ok) {
        throw new Error(
          `Failed to fetch frame image from Fal.ai: ${frameResponse.statusText}`,
        );
      }
      const frameBlob = await frameResponse.blob();
      const frameStorageId = await ctx.storage.store(frameBlob);

      // Dynamically call the success mutation with the original args + new storageId
      await ctx.runMutation(onSuccess.mutation as any, {
        ...onSuccess.args,
        frameStorageId,
      });
    } catch (error) {
      console.error(`Failed to extract ${frameType} frame:`, error);
      // Dynamically call the failure mutation
      await ctx.runMutation(onFailure.mutation as any, {
        ...onFailure.args,
        statusMessage: (error as Error).message,
      });
    }
  },
});

// [MODIFIED] This mutation now receives a generic `frameStorageId`
export const savePoster = internalMutation({
  args: {
    clipId: v.id("videoClipVersions"),
    frameStorageId: v.id("_storage"), // Renamed for clarity
  },
  handler: async (ctx, { clipId, frameStorageId }) => {
    await ctx.db.patch(clipId, {
      posterStorageId: frameStorageId,
      processingStatus: "completed",
      statusMessage: "Thumbnails generated successfully.",
    });

    // [FIX & REUSE] After the poster is saved, kick off embedding generation for it
    // by reusing the existing action.
    await ctx.scheduler.runAfter(
      0,
      internal.media.generateEmbeddingForVideo, // <-- 复用现有函数
      {
        videoClipVersionId: clipId, // <-- 传递正确的参数
      },
    );
  },
});

/**
 * [NEW] Mutation to save the storageId of the last frame's poster.
 */
export const saveLastFramePoster = internalMutation({
  args: {
    clipId: v.id("videoClipVersions"),
    frameStorageId: v.id("_storage"),
  },
  handler: async (ctx, { clipId, frameStorageId }) => {
    await ctx.db.patch(clipId, {
      lastFramePosterStorageId: frameStorageId,
    });
  },
});

/**
 * [NEW] A simple mutation to log a failure without changing primary status.
 */
export const logFailure = internalMutation({
  args: {
    clipId: v.id("videoClipVersions"),
    statusMessage: v.optional(v.string()),
  },
  handler: (_ctx, { clipId, statusMessage }) => {
    console.warn(
      `[logFailure] Non-critical process failed for clip ${clipId}: ${
        statusMessage ?? "Unknown reason"
      }`,
    );
  },
});

// [MODIFIED] This mutation is now more generic for failure handling
export const updateProcessingStatus = internalMutation({
  args: {
    clipId: v.id("videoClipVersions"),
    processingStatus: v.union(v.literal("processing"), v.literal("error")),
    statusMessage: v.optional(v.string()),
  },
  handler: async (ctx, { clipId, processingStatus, statusMessage }) => {
    await ctx.db.patch(clipId, {
      processingStatus,
      statusMessage: statusMessage ?? undefined,
    });
  },
});
