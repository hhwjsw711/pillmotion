"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { createFalClient } from "@fal-ai/client";
import sharp from "sharp";

if (!process.env.FAL_KEY) {
  throw new Error(
    "FAL_KEY is not set. Please run 'bun convex env set FAL_KEY <your-key>'",
  );
}

const fal = createFalClient({
  credentials: process.env.FAL_KEY,
});

export const generateDecoratedImage = internalAction({
  args: {
    imageId: v.id("images"),
    image: v.object({ url: v.string(), storageId: v.id("_storage") }),
    prompt: v.string(),
    shouldDeletePreviousDecorated: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { imageId, image, prompt, shouldDeletePreviousDecorated = false },
  ) => {
    console.log(`[generateDecoratedImage] Starting for image`, {
      imageId,
      prompt,
    });

    const result = await fal.subscribe("fal-ai/flux-kontext-lora", {
      input: {
        image_url: image.url,
        prompt: prompt,
        num_inference_steps: 30,
        guidance_scale: 2.5,
        num_images: 1,
        enable_safety_checker: true,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    });

    // 所有模型返回的数据都在 result.data 中
    const modelOutput = result.data;

    // 从结果中提取图片 URL 和安全标志
    const newImageUrl = modelOutput.images?.[0]?.url;
    const hasNsfwConcept = modelOutput.has_nsfw_concepts?.[0];

    // **优化点**：检查 NSFW 标志
    if (hasNsfwConcept) {
      throw new Error(
        "The generated image was flagged for containing NSFW content.",
      );
    }

    if (!newImageUrl) {
      console.error("Fal.ai response dump:", result);
      throw new Error("No image URL returned from fal.ai endpoint");
    }
    console.log(
      `[generateDecoratedImage] Got image URL from fal.ai: ${newImageUrl}`,
    );

    // 后续的图片下载、处理、存储和数据库更新逻辑保持不变
    const imageResponse = await fetch(newImageUrl);
    if (!imageResponse.ok) {
      throw new Error(
        `Failed to fetch generated image from fal.ai: ${imageResponse.statusText}`,
      );
    }
    const generatedImageBuffer = await imageResponse.arrayBuffer();

    const webpBuffer = await resizeAndConvertToWebp(
      Buffer.from(generatedImageBuffer),
    );
    const webpBlob = new Blob([webpBuffer], { type: "image/webp" });
    const storageId = await ctx.storage.store(webpBlob);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Failed to get storage URL after upload");

    try {
      // Get the current image record to ensure we have the original image reference
      const currentImage = await ctx.runQuery(api.images.getImage, { imageId });
      if (!currentImage) {
        throw new Error(`Could not find image for imageId '${imageId}'`);
      }

      // Ensure we have the original image reference
      let originalImage;
      if (
        currentImage.status.kind === "uploaded" ||
        currentImage.status.kind === "generating" ||
        currentImage.status.kind === "generated"
      ) {
        originalImage = currentImage.status.image;
      }

      if (!originalImage) {
        throw new Error(
          `Could not find original image for imageId '${imageId}' - status: ${currentImage.status.kind}`,
        );
      }

      await ctx.runMutation(internal.images.finishGeneration, {
        imageId,
        image: originalImage, // Always use the original image reference
        decoratedImage: { url, storageId },
        prompt,
      });

      // If we used the decorated image as base, delete it now that we have a new one
      if (shouldDeletePreviousDecorated && image.storageId) {
        await ctx.storage.delete(image.storageId);
      }
    } catch (e) {
      console.error(e);
      await ctx.storage.delete(storageId);
    }

    console.log(`[generateDecoratedImage] Done for imageId: ${imageId}`);
  },
});

/**
 * Resize and convert an image buffer to webp format, max 2048x2048.
 * @param inputBuffer - The input image buffer (PNG, JPEG, etc)
 * @returns Promise<Buffer> - The processed webp image buffer
 */
async function resizeAndConvertToWebp(inputBuffer: Buffer): Promise<Buffer> {
  return sharp(inputBuffer)
    .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 92 })
    .toBuffer();
}
