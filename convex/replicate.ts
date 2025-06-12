"use node";

import Replicate from "replicate";
import OpenAI from "openai";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { Jimp } from "jimp";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const openai = new OpenAI();

const SCALED_IMAGE_WIDTH = 468;
const SCALED_IMAGE_HEIGHT = 850;

export const regenerateSegmentImageUsingPrompt = internalAction({
  args: { segmentId: v.id("segments"), prompt: v.string() },
  handler: async (ctx, args) => {
    try {
      const segment = await ctx.runQuery(internal.segments.getSegmentInternal, {
        segmentId: args.segmentId,
      });
      if (!segment) throw new Error("Segment not found");

      const story = await ctx.runQuery(internal.story.getStoryInternal, {
        storyId: segment.storyId,
      });
      if (!story) throw new Error("Story not found");

      const isVertical = story.format === "vertical";
      const width = isVertical ? 1080 : 1920;
      const height = isVertical ? 1920 : 1080;

      let output: any;
      if (process.env.IMAGE_MODEL === "flux") {
        output = await replicate.run("black-forest-labs/flux-schnell", {
          input: {
            prompt: args.prompt,
            num_outputs: 1,
            disable_safety_checker: false,
            aspect_ratio: isVertical ? "9:16" : "16:9",
            output_format: "jpg",
            output_quality: 90,
          },
        });
      } else {
        output = await replicate.run(
          "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
          {
            input: {
              width,
              height,
              disable_safety_checker: false,
              prompt: args.prompt,
              negative_prompt:
                "nsfw, out of frame, lowres, text, error, cropped, worst quality, low quality, jpeg artifacts, ugly, duplicate, morbid, mutilated, extra fingers, mutated hands, deformed, cross-eyed,",
              num_inference_steps: 50,
              prompt_strength: 0.8,
              high_noise_frac: 0.8,
              guidance_scale: 7.5,
            },
          },
        );
      }

      const url = output[0];
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      const image = await Jimp.read(arrayBuffer);

      const originalImageBuffer = await image.getBuffer("image/jpeg");
      const storageId: Id<"_storage"> = await ctx.storage.store(
        new Blob([originalImageBuffer], { type: "image/jpeg" }),
      );

      const previewImage = image.clone().scaleToFit({
        w: isVertical ? SCALED_IMAGE_WIDTH : SCALED_IMAGE_HEIGHT,
        h: isVertical ? SCALED_IMAGE_HEIGHT : SCALED_IMAGE_WIDTH,
      });
      const previewImageBuffer = await previewImage.getBuffer("image/jpeg");

      const previewStorageId: Id<"_storage"> = await ctx.storage.store(
        new Blob([previewImageBuffer], { type: "image/jpeg" }),
      );

      await ctx.runMutation(internal.imageVersions.createAndSelectVersion, {
        segmentId: args.segmentId,
        userId: story.userId,
        prompt: args.prompt,
        image: storageId,
        previewImage: previewStorageId,
        source: "ai_generated",
      });
    } catch (err) {
      const error = err as Error;
      console.error(error.message);
      await ctx.runMutation(internal.segments.updateSegmentStatus, {
        segmentId: args.segmentId,
        isGenerating: false,
        error: error.message,
      });
    }
  },
});

async function getEditingPrompt(
  originalPrompt: string | undefined,
  newInstruction: string,
) {
  if (!originalPrompt) {
    // If there's no original prompt (e.g. user-uploaded image),
    // we can't do a sophisticated merge. Just use the new instruction.
    return newInstruction;
  }

  const systemPrompt = `You are an expert prompt engineer for an image *editing* model.
Your task is to combine an "Original Prompt" (which describes the current image) with a "New Instruction" (which describes the desired change) into a single, cohesive, and effective new prompt.

**IMPORTANT RULES**:
1. **Preserve Context**: The new prompt must retain all the key elements, style, and composition from the Original Prompt, unless explicitly changed by the New Instruction.
2. **Integrate Change**: Seamlessly integrate the New Instruction into the original description. For example, if the instruction is to "make him smile", find the character in the original prompt and add the description "smiling". If it's to "change background to desert", replace the original background description with "desert background".
3. **Be Specific & Concise**: The final prompt should be a clear, direct instruction to the image model.
4. **Output Language**: The final prompt must be in ENGLISH.
5. **Final Prompt Structure**: The final prompt should be a single, comma-separated string of descriptive phrases. It should sound like a complete image generation prompt that incorporates the edit. Do not add any conversational text or explanations.

**Example 1:**
- Original Prompt: "A majestic lion with a golden mane, standing on a rock, savannah background, cinematic lighting, epic composition."
- New Instruction: "give him a crown"
- Your Output: "A majestic lion with a golden mane wearing a crown, standing on a rock, savannah background, cinematic lighting, epic composition."

**Example 2:**
- Original Prompt: "photo of a sad businessman in a suit, sitting at a desk in a dark office, rain on the window."
- New Instruction: "make it a sunny day"
- Your Output: "photo of a businessman in a suit, sitting at a desk in a bright office, sunny day outside the window."`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Original Prompt: "${originalPrompt}"\nNew Instruction: "${newInstruction}"`,
        },
      ],
      temperature: 0.5,
    });
    // Use optional chaining and nullish coalescing for safety
    return completion.choices[0]?.message?.content ?? newInstruction;
  } catch (error) {
    console.error("Error generating editing prompt:", error);
    // Fallback to the new instruction if the LLM call fails
    return newInstruction;
  }
}

export const editSegmentImageUsingPrompt = internalAction({
  args: {
    segmentId: v.id("segments"),
    newInstruction: v.string(),
    versionIdToEdit: v.id("imageVersions"),
    originalPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const versionToEdit = await ctx.runQuery(
        internal.imageVersions.getVersionInternal,
        { versionId: args.versionIdToEdit },
      );
      if (!versionToEdit) throw new Error("Image version to edit not found");

      const imageUrl = await ctx.storage.getUrl(versionToEdit.image);
      if (!imageUrl) throw new Error("Image URL not found for version to edit");

      const segment = await ctx.runQuery(internal.segments.getSegmentInternal, {
        segmentId: args.segmentId,
      });
      if (!segment) throw new Error("Segment not found");

      const story = await ctx.runQuery(internal.story.getStoryInternal, {
        storyId: segment.storyId,
      });
      if (!story) throw new Error("Story not found");

      const finalPrompt = await getEditingPrompt(
        args.originalPrompt,
        args.newInstruction,
      );

      const output: any = await replicate.run(
        "black-forest-labs/flux-kontext-pro",
        {
          input: {
            prompt: finalPrompt,
            input_image: imageUrl,
            aspect_ratio: "match_input_image",
            safety_tolerance: 2,
          },
        },
      );

      const newImageUrl = output as string;
      const response = await fetch(newImageUrl);
      const arrayBuffer = await response.arrayBuffer();

      const image = await Jimp.read(arrayBuffer);

      const originalImageBuffer = await image.getBuffer("image/jpeg");
      const storageId: Id<"_storage"> = await ctx.storage.store(
        new Blob([originalImageBuffer], { type: "image/jpeg" }),
      );

      const isVertical = story.format === "vertical";
      const previewImage = image.clone().scaleToFit({
        w: isVertical ? SCALED_IMAGE_WIDTH : SCALED_IMAGE_HEIGHT,
        h: isVertical ? SCALED_IMAGE_HEIGHT : SCALED_IMAGE_WIDTH,
      });
      const previewImageBuffer = await previewImage.getBuffer("image/jpeg");

      const previewStorageId: Id<"_storage"> = await ctx.storage.store(
        new Blob([previewImageBuffer], { type: "image/jpeg" }),
      );

      await ctx.runMutation(internal.imageVersions.createAndSelectVersion, {
        segmentId: args.segmentId,
        userId: story.userId,
        prompt: finalPrompt,
        image: storageId,
        previewImage: previewStorageId,
        source: "ai_edited",
      });
    } catch (err) {
      const error = err as Error;
      console.error(error.message);
      await ctx.runMutation(internal.segments.updateSegmentStatus, {
        segmentId: args.segmentId,
        isGenerating: false,
        error: error.message,
      });
    }
  },
});
