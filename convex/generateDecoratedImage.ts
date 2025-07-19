"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { createFalClient } from "@fal-ai/client";
import sharp from "sharp";

const fal = createFalClient({
  credentials: () => process.env.FAL_KEY as string,
});

export const generateDecoratedImage = internalAction({
  args: {
    imageId: v.id("images"),
    image: v.object({ url: v.string(), storageId: v.id("_storage") }),
    generationSettings: v.object({
      prompt: v.string(),
      loraUrl: v.string(),
      styleId: v.optional(v.string()),
    }),
    shouldDeletePreviousDecorated: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { imageId, image, generationSettings, shouldDeletePreviousDecorated = false },
  ) => {
    console.log(`[generateDecoratedImage] Starting for image`, {
      imageId,
      image,
      generationSettings,
    });

    const loras = generationSettings.loraUrl ? [{ path: generationSettings.loraUrl, scale: 1 }] : [];

    const result = await fal.subscribe("fal-ai/flux-kontext-lora", {
      input: {
        image_url: image.url,
        prompt: generationSettings.prompt,
        num_inference_steps: 30,
        guidance_scale: 2.5,
        num_images: 1,
        enable_safety_checker: true,
        output_format: "png",
        resolution_mode: "match_input",
        loras,
      },
    });

    // Handle different possible response structures
    const resultData = (result as any).data || result;
    if (!resultData.images?.[0]) {
      throw new Error("No image generated");
    }

    const response = await fetch(resultData.images[0].url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch uploaded image from storage: ${response.statusText}`,
      );
    }

    const buffer = await response.arrayBuffer();

    // Resize and convert to webp using helper
    let webpBuffer: Buffer;
    try {
      webpBuffer = await resizeAndConvertToWebp(Buffer.from(buffer));
    } catch (err) {
      throw new Error(`Failed to resize/convert image to webp: ${err}`);
    }
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
        generationSettings,
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
