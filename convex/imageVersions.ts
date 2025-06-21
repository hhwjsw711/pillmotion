import {
  internalMutation,
  mutation,
  query,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { Jimp } from "jimp";
import { imageVersionSourceValidator } from "./schema";
import { verifySegmentOwner } from "./lib/auth"; // 1. 导入统一的授权函数
import { Id } from "./_generated/dataModel";

const SCALED_IMAGE_WIDTH = 468;
const SCALED_IMAGE_HEIGHT = 850;

export const getBySegment = query({
  args: { segmentId: v.id("segments") },
  async handler(ctx, args) {
    // 2. 使用集中的授权逻辑，更简洁、更一致
    await verifySegmentOwner(ctx, args.segmentId);

    const versions = await ctx.db
      .query("imageVersions")
      .withIndex("by_segment", (q) => q.eq("segmentId", args.segmentId))
      .order("desc")
      .collect();

    // 3. 预先生成所有图片的URL，解决前端N+1查询问题
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

// 1. 新建一个可复用的内部辅助函数
async function selectVersionHelper(
  ctx: any,
  args: { segmentId: Id<"segments">; versionId: Id<"imageVersions"> },
) {
  // 核心逻辑：选择版本，并清除所有进行中或错误的状态
  await ctx.db.patch(args.segmentId, {
    selectedVersionId: args.versionId,
    isGenerating: false,
    error: undefined,
  });

  // 检查是否需要更新故事封面
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
    const userId = await auth.getUserId(ctx);
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
      userIdString: args.userId, // 新增：为上传的图片添加字符串ID
      image: args.originalImageId,
      previewImage: args.previewImageId,
      source: "user_uploaded",
    });

    // 3. (关键修复) 使用新的辅助函数，它会清除错误状态
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
    const userId = await auth.getUserId(ctx);
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

    // 4. 使用新的辅助函数来统一逻辑并修复bug
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
