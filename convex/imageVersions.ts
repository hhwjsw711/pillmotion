import {
  internalMutation,
  mutation,
  query,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Jimp } from "jimp";

const SCALED_IMAGE_WIDTH = 468;
const SCALED_IMAGE_HEIGHT = 850;

export const getBySegment = query({
  args: { segmentId: v.id("segments") },
  async handler(ctx, args) {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated.");
    }

    // Authorization check: Ensure the user owns the story this segment belongs to.
    const segment = await ctx.db.get(args.segmentId);
    if (!segment) {
      return []; // Return empty array if segment doesn't exist
    }
    const story = await ctx.db.get(segment.storyId);
    if (!story || story.userId !== userId) {
      throw new Error("User not authorized to view these versions.");
    }

    return await ctx.db
      .query("imageVersions")
      .withIndex("by_segment", (q) => q.eq("segmentId", args.segmentId))
      .order("desc")
      .collect();
  },
});

export const createAndSelectVersion = internalMutation({
  args: {
    segmentId: v.id("segments"),
    userId: v.id("users"),
    prompt: v.optional(v.string()),
    image: v.id("_storage"),
    previewImage: v.id("_storage"),
    source: v.union(
      v.literal("ai_generated"),
      v.literal("user_uploaded"),
      v.literal("ai_edited"),
    ),
  },
  async handler(ctx, args) {
    const { segmentId, ...versionArgs } = args;
    const newVersionId = await ctx.db.insert("imageVersions", {
      segmentId,
      ...versionArgs,
    });
    await ctx.db.patch(segmentId, {
      selectedVersionId: newVersionId,
      isGenerating: false,
      error: undefined,
    });
    return newVersionId;
  },
});

export const startUploadAndSelectVersion = mutation({
  args: {
    segmentId: v.id("segments"),
    uploadedImageId: v.id("_storage"),
  },
  async handler(ctx, args) {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User not authenticated.");

    const segment = await ctx.db.get(args.segmentId);
    if (!segment) throw new Error("Segment not found.");

    const story = await ctx.db.get(segment.storyId);
    if (!story || story.userId !== userId) {
      throw new Error("User not authorized to upload to this segment.");
    }

    // Schedule the action to do the file processing.
    await ctx.scheduler.runAfter(
      0,
      internal.imageVersions.processUploadedImage,
      {
        userId,
        segmentId: args.segmentId,
        uploadedImageId: args.uploadedImageId,
        storyFormat: story.format ?? "vertical",
      },
    );

    // Optionally set a processing state on the segment immediately
    await ctx.db.patch(args.segmentId, { isGenerating: true });
  },
});

export const processUploadedImage = internalAction({
  args: {
    userId: v.id("users"),
    segmentId: v.id("segments"),
    uploadedImageId: v.id("_storage"),
    storyFormat: v.string(), // Pass format to avoid extra DB calls
  },
  handler: async (ctx, args) => {
    try {
      const uploadedImage = await ctx.storage.get(args.uploadedImageId);
      if (!uploadedImage) {
        throw new Error("Uploaded image not found in storage.");
      }

      const arrayBuffer = await uploadedImage.arrayBuffer();
      const image = await Jimp.read(arrayBuffer);

      const isVertical = args.storyFormat === "vertical";
      const previewImage = image.clone().scaleToFit({
        w: isVertical ? SCALED_IMAGE_WIDTH : SCALED_IMAGE_HEIGHT,
        h: isVertical ? SCALED_IMAGE_HEIGHT : SCALED_IMAGE_WIDTH,
      });
      const previewImageBuffer = await previewImage.getBuffer("image/jpeg");

      const previewStorageId = await ctx.storage.store(
        new Blob([previewImageBuffer], { type: "image/jpeg" }),
      );

      await ctx.runMutation(internal.imageVersions.createVersionFromUpload, {
        segmentId: args.segmentId,
        userId: args.userId,
        originalImageId: args.uploadedImageId,
        previewImageId: previewStorageId,
      });
    } catch (error: any) {
      console.error(
        `Failed to process uploaded image for segment ${args.segmentId}:`,
        error,
      );
      await ctx.runMutation(internal.segments.updateSegmentStatus, {
        segmentId: args.segmentId,
        isGenerating: false,
        error:
          error.message ||
          "Failed to process uploaded image. It might be corrupted.",
      });
    }
  },
});

export const createVersionFromUpload = internalMutation({
  args: {
    segmentId: v.id("segments"),
    userId: v.id("users"),
    originalImageId: v.id("_storage"),
    previewImageId: v.id("_storage"),
  },
  async handler(ctx, args) {
    const newVersionId = await ctx.db.insert("imageVersions", {
      segmentId: args.segmentId,
      userId: args.userId,
      image: args.originalImageId,
      previewImage: args.previewImageId,
      source: "user_uploaded",
    });

    await ctx.db.patch(args.segmentId, {
      selectedVersionId: newVersionId,
      isGenerating: false, // Turn off processing state
    });
  },
});

export const selectVersion = mutation({
  args: {
    segmentId: v.id("segments"),
    versionId: v.id("imageVersions"),
  },
  async handler(ctx, args) {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User not authenticated.");

    const segment = await ctx.db.get(args.segmentId);
    if (!segment) throw new Error("Segment not found.");

    const story = await ctx.db.get(segment.storyId);
    if (!story || story.userId !== userId) {
      throw new Error("User not authorized to modify this segment.");
    }

    const version = await ctx.db.get(args.versionId);
    if (!version || version.segmentId !== args.segmentId) {
      throw new Error("Version does not belong to this segment.");
    }

    await ctx.db.patch(args.segmentId, {
      selectedVersionId: args.versionId,
    });
  },
});

export const getVersionInternal = internalQuery({
  args: { versionId: v.id("imageVersions") },
  async handler(ctx, args) {
    return await ctx.db.get(args.versionId);
  },
});
