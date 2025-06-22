import {
  internalMutation,
  mutation,
  query,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Jimp } from "jimp";
import { imageVersionSourceValidator } from "./schema";
import { verifySegmentOwner } from "./lib/auth";
import { Id } from "./_generated/dataModel";

const SCALED_IMAGE_WIDTH = 468;
const SCALED_IMAGE_HEIGHT = 850;

export const getBySegment = query({
  args: { segmentId: v.id("segments") },
  async handler(ctx, args) {
    await verifySegmentOwner(ctx, args.segmentId);

    const versions = await ctx.db
      .query("imageVersions")
      .withIndex("by_segment", (q) => q.eq("segmentId", args.segmentId))
      .order("desc")
      .collect();

    const versionsWithUrls = await Promise.all(
      versions.map(async (version) => {
        const previewImageUrl = version.previewImage
          ? await ctx.storage.getUrl(version.previewImage)
          : null;
        return {
          ...version,
          previewImageUrl,
        };
      }),
    );

    return versionsWithUrls;
  },
});

/**
 * [FIXED] The helper function for selecting an image version.
 * It now correctly clears any previously selected video clip, ensuring
 * a consistent and unambiguous UI state.
 */
async function selectVersionHelper(
  ctx: any,
  args: { segmentId: Id<"segments">; versionId: Id<"imageVersions"> },
) {
  // [CRITICAL FIX] When an image is selected, any selected video must be deselected.
  // This makes the UI logic much simpler and more predictable.
  await ctx.db.patch(args.segmentId, {
    selectedVersionId: args.versionId,
    selectedVideoClipVersionId: undefined, // Clear the selected video
    isGenerating: false,
    error: undefined,
  });

  // Check if this is the first segment to update the story's main thumbnail.
  const segment = await ctx.db.get(args.segmentId);
  if (segment && segment.order === 0) {
    await ctx.scheduler.runAfter(
      0,
      internal.story.internalUpdateStoryThumbnail,
      {
        storyId: segment.storyId,
      },
    );
  }
}

export const createAndSelectVersion = internalMutation({
  args: {
    segmentId: v.id("segments"),
    userId: v.id("users"),
    prompt: v.string(),
    image: v.id("_storage"),
    previewImage: v.id("_storage"),
    source: imageVersionSourceValidator,
  },
  handler: async (ctx, args) => {
    const versionId = await ctx.db.insert("imageVersions", {
      ...args,
      userIdString: args.userId,
    });
    // When a new image is created, it should become the selected one.
    await selectVersionHelper(ctx, {
      segmentId: args.segmentId,
      versionId: versionId,
    });
    return versionId;
  },
});

export const startUploadAndSelectVersion = mutation({
  args: {
    segmentId: v.id("segments"),
    uploadedImageId: v.id("_storage"),
  },
  async handler(ctx, args) {
    const { userId, story } = await verifySegmentOwner(ctx, args.segmentId);
    if (!story) throw new Error("Story not found for segment.");

    await ctx.db.patch(args.segmentId, { isGenerating: true });

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
  },
});

export const processUploadedImage = internalAction({
  args: {
    userId: v.id("users"),
    segmentId: v.id("segments"),
    uploadedImageId: v.id("_storage"),
    storyFormat: v.string(),
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
      console.error(`Failed to process uploaded image for segment ${args.segmentId}:`, error);
      await ctx.runMutation(internal.segments.updateSegmentStatus, {
        segmentId: args.segmentId,
        isGenerating: false,
        error: error.message || "Failed to process uploaded image.",
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
      userIdString: args.userId,
      image: args.originalImageId,
      previewImage: args.previewImageId,
      source: "user_uploaded",
    });

    await selectVersionHelper(ctx, {
      segmentId: args.segmentId,
      versionId: newVersionId,
    });
  },
});

export const selectVersion = mutation({
  args: {
    segmentId: v.id("segments"),
    versionId: v.id("imageVersions"),
  },
  async handler(ctx, args) {
    await verifySegmentOwner(ctx, args.segmentId);

    const version = await ctx.db.get(args.versionId);
    if (!version || version.segmentId !== args.segmentId) {
      throw new Error("Version does not belong to this segment.");
    }

    await selectVersionHelper(ctx, {
      segmentId: args.segmentId,
      versionId: args.versionId,
    });
  },
});

export const getVersionInternal = internalQuery({
  args: { versionId: v.id("imageVersions") },
  async handler(ctx, args) {
    return await ctx.db.get(args.versionId);
  },
});