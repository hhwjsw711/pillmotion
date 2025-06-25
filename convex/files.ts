import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { verifySegmentOwner } from "./lib/auth";
import { internal } from "./_generated/api";

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const saveUserUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    mimeType: v.string(),
    segmentId: v.id("segments"), // We need context for where this is uploaded
  },
  handler: async (ctx, { storageId, mimeType, segmentId }) => {
    const { userId } = await verifySegmentOwner(ctx, segmentId);

    if (mimeType.startsWith("image/")) {
      await ctx.db.insert("imageVersions", {
        userId,
        userIdString: userId,
        segmentId,
        image: storageId,
        previewImage: storageId, // For user uploads, original and preview are the same
        source: "user_uploaded",
      });
      // No automatic frame extraction for images
      return { isVideo: false };
    } else if (mimeType.startsWith("video/")) {
      const videoClipVersionId = await ctx.db.insert("videoClipVersions", {
        userId,
        userIdString: userId,
        segmentId,
        storageId,
        // [FIX] Use the new, correct context type for user uploads
        context: {
          type: "user_uploaded",
        },
        generationStatus: "generated", // It's already generated
        processingStatus: "processing", // It now needs thumbnails
      });

      // CRITICAL: Kick off the thumbnail generation process
      await ctx.scheduler.runAfter(
        0,
        internal.videoProcessing.generateVideoThumbnails,
        {
          clipId: videoClipVersionId,
        },
      );

      return { isVideo: true, videoClipVersionId };
    }

    // If it's not an image or a video, we don't handle it.
    // You might want to add deletion logic here for unsupported files.
    console.warn(`Unsupported file type uploaded: ${mimeType}`);
    return { isVideo: false };
  },
});

export const getUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    const urls = await Promise.all(
      args.storageIds.map((storageId) => ctx.storage.getUrl(storageId)),
    );
    // Filter out nulls in case some URLs failed to generate
    return urls.filter((url): url is string => url !== null);
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  const userId = await auth.getUserId(ctx);
  if (!userId) {
    throw new Error("User must be authenticated to generate an upload URL.");
  }
  return await ctx.storage.generateUploadUrl();
});
