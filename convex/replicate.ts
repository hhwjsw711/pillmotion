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

async function getEnhancedStylePrompt(styleInstruction: string) {
  if (!styleInstruction || styleInstruction.trim() === "") {
    return "";
  }

  const systemPrompt = `You are an expert prompt engineer for an AI image generation model.
Your task is to take a user's style instruction, provided inside <UserInstruction> tags, and expand it into a rich, descriptive, and effective prompt fragment.
This fragment will be prepended to a specific scene description to ensure a consistent artistic style across multiple images.

**IMPORTANT RULES**:
1.  **Enrich, Don't Invent**: Elaborate on the user's core idea. If they say "cyberpunk," expand on what that means (e.g., "cyberpunk aesthetic, neon-drenched cityscapes, gritty atmosphere, high-tech low-life"). Do not invent completely new concepts not implied by the instruction.
2.  **Use Descriptive Adjectives**: Use strong, descriptive words. Instead of "nice," think "serene, tranquil, harmonious."
3.  **Format as a Fragment**: Your output MUST be a comma-separated string of descriptive phrases, ready to be placed at the start of another prompt. Do NOT write a complete sentence, a question, or any surrounding quotes.
4.  **Stay Stylistic**: Focus only on visual style, mood, lighting, and composition. Do not add story elements or characters.
5.  **Output Language**: The final prompt must be in ENGLISH.

**Example 1:**
- User Input: <UserInstruction>Ghibli style</UserInstruction>
- Your Output: in the style of Studio Ghibli, anime, hand-drawn, vibrant watercolor backgrounds, nostalgic and heartwarming atmosphere

**Example 2:**
- User Input: <UserInstruction>make it look cool</UserInstruction>
- Your Output: epic cinematic lighting, dramatic shadows, high contrast, professional digital painting, trending on artstation
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `<UserInstruction>${styleInstruction}</UserInstruction>`,
        },
      ],
      temperature: 0.5,
    });
    return completion.choices[0]?.message?.content ?? styleInstruction;
  } catch (error) {
    console.error("Error enhancing style prompt:", error);
    // Fallback to the original instruction if the LLM call fails
    return styleInstruction;
  }
}

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

      const scenePrompt = args.prompt;
      let finalPrompt = scenePrompt;
      // If a global style prompt exists, enhance it and then prepend it.
      if (story.stylePrompt && story.stylePrompt.trim() !== "") {
        const enhancedStyle = await getEnhancedStylePrompt(story.stylePrompt);
        finalPrompt = `${enhancedStyle}, ${scenePrompt}`;
      }

      const isVertical = story.format === "vertical";
      const width = isVertical ? 1080 : 1920;
      const height = isVertical ? 1920 : 1080;

      let output: any;
      if (process.env.IMAGE_MODEL === "flux") {
        output = await replicate.run("black-forest-labs/flux-schnell", {
          input: {
            prompt: finalPrompt,
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
              prompt: finalPrompt,
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

      const url = String(output[0]);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      let image = await Jimp.read(arrayBuffer);

      if (image.width < width || image.height < height) {
        console.log(
          `Image is smaller than target. Upscaling... Original: ${image.width}x${image.height}, Target: ${width}x${height}`,
        );
        const output = (await replicate.run(
          "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
          {
            input: {
              image: url,
              scale: 2, // Upscale by 2x, can be adjusted
            },
          },
        )) as unknown as string;

        const upscaledResponse = await fetch(output);
        const upscaledArrayBuffer = await upscaledResponse.arrayBuffer();
        image = await Jimp.read(upscaledArrayBuffer);
      }

      // Use `cover` with the correct object syntax to enforce standard dimensions.
      image.cover({ w: width, h: height });

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
        prompt: finalPrompt,
        image: storageId,
        previewImage: previewStorageId,
        source: "ai_generated",
      });
      if (segment.order === 0) {
        await ctx.scheduler.runAfter(
          0,
          internal.story.internalUpdateStoryThumbnail,
          {
            storyId: segment.storyId,
          },
        );
      }
      // On success, explicitly return true.
      return true;
    } catch (err) {
      const error = err as Error;
      console.error(error.message);
      await ctx.runMutation(internal.segments.updateSegmentStatus, {
        segmentId: args.segmentId,
        isGenerating: false,
        error: error.message,
      });

      // On failure, explicitly return false.
      return false;
    }
  },
});

async function getEditingPrompt(
  originalPrompt: string | undefined,
  newInstruction: string,
  styleGuide: string | undefined,
) {
  // If there's no original prompt, the task is simpler. No need for a complex merge.
  if (!originalPrompt) {
    if (styleGuide && styleGuide.trim() !== "") {
      return `${styleGuide}, ${newInstruction}`;
    }
    return newInstruction;
  }

  const systemPrompt = `You are an expert prompt engineer for an image *editing* model.
Your task is to create a new, cohesive, and effective prompt by intelligently combining information from three sources, provided in XML-like tags: <OverallStyleGuide>, <OriginalPrompt>, and <NewInstruction>.

**IMPORTANT RULES**:
1.  **Prioritize Style Guide**: The final prompt's style MUST be dictated by the content within <OverallStyleGuide>. If the <OriginalPrompt> contains conflicting style descriptions, they MUST be replaced. The style guide should typically form the beginning of the new prompt.
2.  **Preserve Context**: Retain all key non-style elements (characters, objects, composition) from the <OriginalPrompt>, unless explicitly changed by the <NewInstruction>.
3.  **Integrate Change**: Seamlessly integrate the <NewInstruction> into the prompt. For example, if the instruction is "make him smile", find the character and add "smiling".
4.  **Be Specific & Concise**: The final prompt should be a clear, direct instruction to the image model.
5.  **Output Language**: The final prompt must be in ENGLISH.
6.  **Final Prompt Structure**: The final prompt should be a single, comma-separated string of descriptive phrases. Do not add any conversational text, explanations, or surrounding quotes.

**Example 1:**
- User Input:
<OverallStyleGuide>in the style of a gritty comic book, dark, heavy shadows</OverallStyleGuide>
<OriginalPrompt>A majestic lion with a golden mane, standing on a rock, cinematic lighting.</OriginalPrompt>
<NewInstruction>give him a crown</NewInstruction>
- Your Output: in the style of a gritty comic book, dark, heavy shadows, a majestic lion with a golden mane wearing a crown, standing on a rock

**Example 2:**
- User Input:
<OverallStyleGuide>vibrant watercolor painting</OverallStyleGuide>
<OriginalPrompt>photo of a sad businessman in a suit, sitting at a desk in a dark office, rain on the window.</OriginalPrompt>
<NewInstruction>make it a sunny day</NewInstruction>
- Your Output: vibrant watercolor painting of a businessman in a suit, sitting at a desk in a bright office, sunny day outside the window.`;

  const userContent = `<OverallStyleGuide>
${styleGuide ?? "None provided. Adhere to the original prompt's style."}
</OverallStyleGuide>
<OriginalPrompt>
${originalPrompt}
</OriginalPrompt>
<NewInstruction>
${newInstruction}
</NewInstruction>`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: userContent,
        },
      ],
      temperature: 0.5,
    });
    // Use optional chaining and nullish coalescing for safety
    return completion.choices[0]?.message?.content ?? newInstruction;
  } catch (error) {
    console.error("Error generating editing prompt:", error);
    // Fallback to a simple concatenation if the LLM fails. This is not perfect but better than nothing.
    const fallback = `${newInstruction}, ${originalPrompt}`;
    if (styleGuide) {
      return `${styleGuide}, ${fallback}`;
    }
    return fallback;
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

      // Enhance the story's style prompt before using it.
      const enhancedStyle = story.stylePrompt
        ? await getEnhancedStylePrompt(story.stylePrompt)
        : undefined;

      const finalPrompt = await getEditingPrompt(
        args.originalPrompt,
        args.newInstruction,
        enhancedStyle, // Pass the enhanced style guide
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

      const newImageUrl = String(output);
      const response = await fetch(newImageUrl);
      const arrayBuffer = await response.arrayBuffer();

      let image = await Jimp.read(arrayBuffer);

      // Enforce standard dimensions to ensure consistency across all image versions.
      const isVertical = story.format === "vertical";
      const width = isVertical ? 1080 : 1920;
      const height = isVertical ? 1920 : 1080;

      // Upscale if the image is smaller than the target dimensions to avoid quality loss.
      if (image.width < width || image.height < height) {
        console.log(
          `Image is smaller than target. Upscaling... Original: ${image.width}x${image.height}, Target: ${width}x${height}`,
        );
        const output = (await replicate.run(
          "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
          {
            input: {
              image: newImageUrl,
              scale: 2,
            },
          },
        )) as unknown as string;

        const upscaledResponse = await fetch(output);
        const upscaledArrayBuffer = await upscaledResponse.arrayBuffer();
        image = await Jimp.read(upscaledArrayBuffer);
      }

      // Use `cover` with the correct object syntax to enforce standard dimensions.
      image.cover({ w: width, h: height });

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
        prompt: finalPrompt,
        image: storageId,
        previewImage: previewStorageId,
        source: "ai_edited",
      });
      if (segment.order === 0) {
        await ctx.scheduler.runAfter(
          0,
          internal.story.internalUpdateStoryThumbnail,
          {
            storyId: segment.storyId,
          },
        );
      }
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
