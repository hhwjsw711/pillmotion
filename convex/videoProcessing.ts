import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { fal } from "@fal-ai/client";

// Use the Fal.ai client, unifying our AI providers
fal.config({
  credentials: process.env.FAL_KEY,
});

// Action to generate a single poster image from a video
export const generatePoster = internalAction({
  args: {
    storageId: v.id("_storage"),
    clipId: v.id("videoClipVersions"),
  },
  handler: async (ctx, { storageId, clipId }) => {
    await ctx.runMutation(internal.videoProcessing.updateProcessingStatus, {
      clipId,
      processingStatus: "processing",
    });

    try {
      const videoUrl = await ctx.storage.getUrl(storageId);
      if (!videoUrl) {
        throw new Error(`Could not get video URL for storageId: ${storageId}`);
      }

      // 1. Generate Poster Image using Fal.ai's dedicated frame extraction model
      const result: any = await fal.subscribe(
        "fal-ai/ffmpeg-api/extract-frame",
        {
          input: {
            video_url: videoUrl,
            // Per docs, `frame_type` defaults to "first", which is exactly what we need.
          },
          // Adding logs as per your best practice suggestion
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS" && update.logs) {
              update.logs.forEach((log) => console.log(log.message));
            }
          },
        },
      );

      // [FIX] Correctly access the nested 'data' property in the response.
      const posterUrl = result.data?.images?.[0]?.url;
      if (!posterUrl) {
        console.error("Fal.ai API response:", result);
        throw new Error("Fal.ai did not return a valid poster image URL.");
      }

      // 2. Store the generated poster image in Convex storage
      const posterResponse = await fetch(posterUrl);
      if (!posterResponse.ok) {
        throw new Error(
          `Failed to fetch poster image from Fal.ai: ${posterResponse.statusText}`,
        );
      }
      const posterBlob = await posterResponse.blob();
      const posterStorageId = await ctx.storage.store(posterBlob);

      // 3. Update the video clip version with the new poster storage ID
      await ctx.runMutation(internal.videoProcessing.savePoster, {
        clipId,
        posterStorageId,
      });
    } catch (error) {
      console.error(`Failed to generate poster for clip ${clipId}:`, error);
      await ctx.runMutation(internal.videoProcessing.updateProcessingStatus, {
        clipId,
        processingStatus: "error",
        statusMessage: (error as Error).message,
      });
    }
  },
});

// Mutation to save the generated poster storage ID
export const savePoster = internalMutation({
  args: {
    clipId: v.id("videoClipVersions"),
    posterStorageId: v.id("_storage"),
  },
  handler: async (ctx, { clipId, posterStorageId }) => {
    await ctx.db.patch(clipId, {
      posterStorageId,
      processingStatus: "completed",
    });
  },
});

// Mutation to update the processing status
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
