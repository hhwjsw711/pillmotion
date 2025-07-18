import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { match } from "ts-pattern";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const uploadUrl = await ctx.storage.generateUploadUrl();

    const imageId = await ctx.db.insert("images", {
      userId,
      status: { kind: "uploading" },
    });

    return { uploadUrl, imageId };
  },
});

export const markUploaded = mutation({
  args: {
    imageId: v.id("images"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const image = await ctx.db.get(args.imageId);
    if (!image) throw new Error(`Image with id '${args.imageId}' not found`);
    if (image.userId !== userId)
      throw new Error(
        `Image with id '${args.imageId}' does not belong to the authenticated user`,
      );

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Failed to get URL");

    console.log(
      `[markUploaded] Marking image ${args.imageId} as uploaded with storageId ${args.storageId}`,
    );

    await ctx.db.patch(args.imageId, {
      status: { kind: "uploaded", image: { url, storageId: args.storageId } },
    });
  },
});

// Helper function to validate user access to image
async function validateImageAccess(ctx: any, imageId: any, userId: string) {
  const image = await ctx.db.get(imageId);
  if (!image) throw new Error(`Image with id '${imageId}' not found`);
  if (image.userId !== userId)
    throw new Error(
      `Image with id '${imageId}' does not belong to the authenticated user`,
    );
  return image;
}

export const startGeneration = mutation({
  args: {
    imageId: v.id("images"),
    generationSettings: v.object({
      prompt: v.string(),
      loraUrl: v.string(),
      styleId: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const image = await validateImageAccess(ctx, args.imageId, userId);

    if (image.status.kind !== "uploaded")
      throw new Error(
        `Image with id '${args.imageId}' not ready for generation (status: ${image.status.kind})`,
      );

    const imageObj = image.status.image;
    if (!imageObj)
      throw new Error(
        `Image object missing for imageId '${args.imageId}' in startGeneration`,
      );

    await ctx.db.patch(args.imageId, {
      status: { kind: "generating", image: imageObj, generationSettings: args.generationSettings },
    });

    // Schedule the AI generation
    await ctx.scheduler.runAfter(
      0,
      internal.generateDecoratedImage.generateDecoratedImage,
      {
        imageId: args.imageId,
        image: imageObj,
        generationSettings: args.generationSettings,
      },
    );
  },
});

export const startRegeneration = mutation({
  args: {
    imageId: v.id("images"),
    generationSettings: v.object({
      prompt: v.string(),
      loraUrl: v.string(),
      styleId: v.optional(v.string()),
    }),
    baseImage: v.union(v.literal("original"), v.literal("decorated")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const image = await validateImageAccess(ctx, args.imageId, userId);

    if (image.status.kind !== "generated")
      throw new Error(
        `Image with id '${args.imageId}' must be in generated status for regeneration (current status: ${image.status.kind})`,
      );

    if (!image.status.image || !image.status.decoratedImage)
      throw new Error(
        `Missing image data for regeneration on imageId '${args.imageId}'`,
      );

    // Determine which image to use as the base
    const baseImageObj =
      args.baseImage === "decorated"
        ? image.status.decoratedImage
        : image.status.image;

    // Delete the current decorated image only if we're not using it as the base
    if (args.baseImage === "original") {
      await ctx.storage.delete(image.status.decoratedImage.storageId);
    }

    await ctx.db.patch(args.imageId, {
      status: {
        kind: "generating",
        image: image.status.image,
        generationSettings: args.generationSettings,
      },
    });

    // Schedule the AI generation
    await ctx.scheduler.runAfter(
      0,
      internal.generateDecoratedImage.generateDecoratedImage,
      {
        imageId: args.imageId,
        image: baseImageObj,
        generationSettings: args.generationSettings,
        shouldDeletePreviousDecorated: args.baseImage === "decorated",
      },
    );
  },
});

export const findImage = query({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.imageId);
  },
});

export const getImage = query({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.imageId);
    if (!image) throw new Error("Image not found");
    return image;
  },
});

export const finishGeneration = internalMutation({
  args: {
    imageId: v.id("images"),
    image: v.object({ url: v.string(), storageId: v.id("_storage") }),
    decoratedImage: v.object({ url: v.string(), storageId: v.id("_storage") }),
    generationSettings: v.object({
      prompt: v.string(),
      loraUrl: v.string(),
      styleId: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.imageId, {
      status: {
        kind: "generated",
        image: args.image,
        decoratedImage: args.decoratedImage,
        generationSettings: args.generationSettings,
      },
    });
  },
});

export const listImages = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("images")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

export const deleteImage = mutation({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const image = await ctx.db.get(args.imageId);
    if (!image) throw new Error("Image not found");

    if (image.userId != userId)
      throw new Error(
        `Image with id '${args.imageId}' does not belong to the authenticated user`,
      );

    await match(image.status)
      .with({ kind: "uploading" }, async () => {
        // No storage to delete
      })
      .with({ kind: "uploaded" }, async ({ image }) => {
        if (!image) return;
        await ctx.storage.delete(image.storageId);
      })
      .with({ kind: "generating" }, async ({ image }) => {
        if (!image) return;
        await ctx.storage.delete(image.storageId);
      })
      .with({ kind: "generated" }, async ({ image, decoratedImage }) => {
        if (image) await ctx.storage.delete(image.storageId);
        if (decoratedImage) await ctx.storage.delete(decoratedImage.storageId);
      })
      .exhaustive();

    await ctx.db.delete(args.imageId);
  },
});
