"use node";

import Replicate from "replicate";
import OpenAI from "openai";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { Jimp } from "jimp";
import { fal } from "@fal-ai/client";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

fal.config({
  credentials: process.env.FAL_KEY,
});

const openai = new OpenAI();

const SCALED_IMAGE_WIDTH = 468;
const SCALED_IMAGE_HEIGHT = 850;

// =================================================================
// >> Section 1: AI Prompt Engineering Helpers (No changes)
// =================================================================

async function getEnhancedStylePrompt(styleInstruction: string) {
  if (!styleInstruction || styleInstruction.trim() === "") {
    return "";
  }
  const systemPrompt = `You are an expert prompt engineer for an AI image generation model. Your task is to take a user's style instruction, provided inside <UserInstruction> tags, and expand it into a rich, descriptive, and effective prompt fragment. This fragment will be prepended to a specific scene description to ensure a consistent artistic style across multiple images. **IMPORTANT RULES**: 1. **Enrich, Don't Invent**: Elaborate on the user's core idea. If they say "cyberpunk," expand on what that means (e.g., "cyberpunk aesthetic, neon-drenched cityscapes, gritty atmosphere, high-tech low-life"). Do not invent completely new concepts not implied by the instruction. 2. **Use Descriptive Adjectives**: Use strong, descriptive words. Instead of "nice," think "serene, tranquil, harmonious." 3. **Format as a Fragment**: Your output MUST be a comma-separated string of descriptive phrases, ready to be placed at the start of another prompt. Do NOT write a complete sentence, a question, or any surrounding quotes. 4. **Stay Stylistic**: Focus only on visual style, mood, lighting, and composition. Do not add story elements or characters. 5. **Output Language**: The final prompt must be in ENGLISH. **Example 1:** - User Input: <UserInstruction>Ghibli style</UserInstruction> - Your Output: in the style of Studio Ghibli, anime, hand-drawn, vibrant watercolor backgrounds, nostalgic and heartwarming atmosphere **Example 2:** - User Input: <UserInstruction>make it look cool</UserInstruction> - Your Output: epic cinematic lighting, dramatic shadows, high contrast, professional digital painting, trending on artstation`;
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
    return styleInstruction;
  }
}

async function generateVideoPrompt(
  sceneText: string,
  styleGuide: string | undefined,
) {
  const systemPrompt = `You are an expert film director and cinematographer. Your task is to convert a simple narrative scene description into a rich, detailed, and actionable prompt for a text-to-video AI model. The final prompt must be in ENGLISH and should be a single, comma-separated string of descriptive phrases. You will be given the original narrative text in <SceneText> tags and an overall style guide in <StyleGuide> tags. **Your prompt MUST describe:** 1. **Cinematography**: Specify the shot type (e.g., wide shot, medium close-up, aerial shot) and camera movement (e.g., static, slow pan, tracking shot, dolly zoom, handheld). 2. **Subject & Action**: Clearly describe the main character(s) and their specific actions. 3. **Environment**: Detail the setting, lighting, and overall mood. **Example 1:** - Input: <SceneText>A princess lived in a castle.</SceneText> <StyleGuide>Ghibli style</StyleGuide> - Your Output: Ghibli style, wide shot of a magnificent castle perched on a hill, a young princess visible in a high tower window, slow panning motion across the landscape, soft morning light, cinematic. **Example 2:** - Input: <SceneText>The knight charged the dragon.</SceneText> <StyleGuide>Epic fantasy film</StyleGuide> - Your Output: Epic fantasy film, dynamic low-angle tracking shot, a knight in shining armor charges forward on horseback, a massive dragon rears up ahead breathing fire, dramatic lighting, lens flare.`;
  const userContent = `<SceneText>${sceneText}</SceneText>\n<StyleGuide>${
    styleGuide ?? "General cinematic style"
  }</StyleGuide>`;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
    });
    return completion.choices[0]?.message?.content ?? sceneText;
  } catch (error) {
    console.error("Error generating video prompt:", error);
    return sceneText;
  }
}

async function generateTransitionPrompt(
  startPrompt: string | undefined,
  endPrompt: string | undefined,
  transitionInstruction: string | undefined,
) {
  const systemPrompt = `You are an expert film director and cinematographer. Your task is to convert a start scene, an end scene, and a transition instruction into a single, rich, and actionable prompt for an image-to-video AI model. The final prompt must be in ENGLISH and should be a single, comma-separated string of descriptive phrases. You will be given the prompt for the start image in <StartPrompt>, the prompt for the end image in <EndPrompt>, and a transition instruction in <TransitionInstruction>. **Your prompt MUST describe a continuous motion** that logically connects the start and end visuals. The AI will see the start image, so your prompt should focus on the *action of transitioning*. **Example 1:** - Input: <StartPrompt>A knight stands in front of a castle</StartPrompt> <EndPrompt>The knight is inside the throne room</EndPrompt> <TransitionInstruction>dolly zoom</TransitionInstruction> - Your Output: A fast dolly zoom effect, the camera moves rapidly through the castle gate, the scene morphs from the castle exterior to the grand throne room where the knight now stands. **Example 2:** - Input: <StartPrompt>A single red apple on a table</StartPrompt> <EndPrompt>A whole apple pie on the table</EndPrompt> <TransitionInstruction>A quick blur</TransitionInstruction> - Your Output: A quick blur transition, the red apple spins and dissolves into a freshly baked apple pie in the same spot, motion blur, time-lapse effect.`;
  const userContent = `<StartPrompt>${
    startPrompt ?? "the first scene"
  }</StartPrompt>\n<EndPrompt>${
    endPrompt ?? "the second scene"
  }</EndPrompt>\n<TransitionInstruction>${
    transitionInstruction ?? "A smooth transition"
  }</TransitionInstruction>`;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
    });
    return (
      completion.choices[0]?.message?.content ??
      transitionInstruction ??
      "A smooth video transition"
    );
  } catch (error) {
    console.error("Error generating transition prompt:", error);
    return transitionInstruction ?? "A smooth video transition";
  }
}

async function getEditingPrompt(
  originalPrompt: string | undefined,
  newInstruction: string,
  styleGuide: string | undefined,
) {
  if (!originalPrompt) {
    if (styleGuide && styleGuide.trim() !== "") {
      return `${styleGuide}, ${newInstruction}`;
    }
    return newInstruction;
  }
  const systemPrompt = `You are an expert prompt engineer for an image *editing* model. Your task is to create a new, cohesive, and effective prompt by intelligently combining information from three sources, provided in XML-like tags: <OverallStyleGuide>, <OriginalPrompt>, and <NewInstruction>. **IMPORTANT RULES**: 1. **Prioritize Style Guide**: The final prompt's style MUST be dictated by the content within <OverallStyleGuide>. If the <OriginalPrompt> contains conflicting style descriptions, they MUST be replaced. The style guide should typically form the beginning of the new prompt. 2. **Preserve Context**: Retain all key non-style elements (characters, objects, composition) from the <OriginalPrompt>, unless explicitly changed by the <NewInstruction>. 3. **Integrate Change**: Seamlessly integrate the <NewInstruction> into the prompt. For example, if the instruction is "make him smile", find the character and add "smiling". 4. **Be Specific & Concise**: The final prompt should be a clear, direct instruction to the image model. 5. **Output Language**: The final prompt must be in ENGLISH. 6. **Final Prompt Structure**: The final prompt should be a single, comma-separated string of descriptive phrases. Do not add any conversational text, explanations, or surrounding quotes. **Example 1:** - User Input: <OverallStyleGuide>in the style of a gritty comic book, dark, heavy shadows</OverallStyleGuide> <OriginalPrompt>A majestic lion with a golden mane, standing on a rock, cinematic lighting.</OriginalPrompt> <NewInstruction>give him a crown</NewInstruction> - Your Output: in the style of a gritty comic book, dark, heavy shadows, a majestic lion with a golden mane wearing a crown, standing on a rock **Example 2:** - User Input: <OverallStyleGuide>vibrant watercolor painting</OverallStyleGuide> <OriginalPrompt>photo of a sad businessman in a suit, sitting at a desk in a dark office, rain on the window.</OriginalPrompt> <NewInstruction>make it a sunny day</NewInstruction> - Your Output: vibrant watercolor painting of a businessman in a suit, sitting at a desk in a bright office, sunny day outside the window.`;
  const userContent = `<OverallStyleGuide>\n${
    styleGuide ?? "None provided. Adhere to the original prompt's style."
  }\n</OverallStyleGuide>\n<OriginalPrompt>\n${originalPrompt}\n</OriginalPrompt>\n<NewInstruction>\n${newInstruction}\n</NewInstruction>`;
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
    return completion.choices[0]?.message?.content ?? newInstruction;
  } catch (error) {
    console.error("Error generating editing prompt:", error);
    const fallback = `${newInstruction}, ${originalPrompt}`;
    if (styleGuide) {
      return `${styleGuide}, ${fallback}`;
    }
    return fallback;
  }
}

// =================================================================
// >> Section 2: Image Generation Actions (FULLY REVISED)
// =================================================================

export const regenerateSegmentImageUsingPrompt = internalAction({
  args: {
    segmentId: v.id("segments"),
    prompt: v.string(),
    characterId: v.optional(v.id("characters")),
  },
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

      let finalPrompt = args.prompt;
      if (story.stylePrompt && story.stylePrompt.trim() !== "") {
        const enhancedStyle = await getEnhancedStylePrompt(story.stylePrompt);
        finalPrompt = `${enhancedStyle}, ${finalPrompt}`;
      }

      const isVertical = story.format === "vertical";
      let output: any;

      if (args.characterId) {
        // ========== PATH 1: GENERATE WITH A CHARACTER MODEL (FLUX) ==========
        console.log(`Character model path selected for ${args.characterId}`);

        // [FIX 1] Call the correct public query via `api`
        const character = await ctx.runQuery(api.characters.getSystem, {
          characterId: args.characterId,
        });

        if (!character) {
          throw new Error(`Character ${args.characterId} not found.`);
        }
        if (character.status !== "ready") {
          throw new Error(`Character ${character.name} is not ready.`);
        }
        if (
          !character.replicateModelDestination ||
          !character.replicateModelVersion ||
          !character.triggerWord
        ) {
          throw new Error(
            `Character ${character.name} is missing Replicate data.`,
          );
        }

        // [FIX 2] Build the string and then use a type assertion in the `run` call
        const modelString = `${character.replicateModelDestination}:${character.replicateModelVersion}`;

        const finalPromptWithTrigger = `${character.triggerWord}, ${finalPrompt}`;
        console.log(`Generating with character model: ${modelString}`);

        output = await replicate.run(
          modelString as `${string}/${string}:${string}`,
          {
            input: {
              prompt: finalPromptWithTrigger,
              aspect_ratio: isVertical ? "9:16" : "16:9",
              output_format: "jpg",
              output_quality: 90,
            },
          },
        );
      } else {
        // ========== PATH 2: GENERATE WITH A DEFAULT MODEL ==========
        const imageModel = process.env.IMAGE_MODEL ?? "sdxl";
        console.log(`Default model path selected: ${imageModel}`);

        if (imageModel === "flux") {
          // --- Sub-path 2a: Default is FLUX ---
          output = await replicate.run("black-forest-labs/flux-schnell", {
            input: {
              prompt: finalPrompt,
              aspect_ratio: isVertical ? "9:16" : "16:9",
              output_format: "jpg",
              output_quality: 90,
            },
          });
        } else {
          // --- Sub-path 2b: Default is SDXL (or not set) ---
          const width = isVertical ? 1080 : 1920;
          const height = isVertical ? 1920 : 1080;
          output = await replicate.run(
            "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
            {
              input: {
                width,
                height,
                prompt: finalPrompt,
                output_format: "jpeg",
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
      }

      // ========== COMMON LOGIC: IMAGE PROCESSING AND STORAGE ==========
      const url = String(output[0]);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      // This will now work reliably as we always get JPG/JPEG
      let image = await Jimp.read(arrayBuffer);

      const finalWidth = isVertical ? 1080 : 1920;
      const finalHeight = isVertical ? 1920 : 1080;

      if (image.width < finalWidth || image.height < finalHeight) {
        console.log(
          `Upscaling needed (current: ${image.width}x${image.height}, target: ${finalWidth}x${finalHeight})...`,
        );
        const upscalerOutput = (await replicate.run(
          "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
          { input: { image: url, scale: 2 } },
        )) as unknown as string;
        const upscaledResponse = await fetch(upscalerOutput);
        const upscaledArrayBuffer = await upscaledResponse.arrayBuffer();
        image = await Jimp.read(upscaledArrayBuffer);
      }

      image.cover({ w: finalWidth, h: finalHeight });
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

      const newImageVersionId = await ctx.runMutation(
        internal.imageVersions.createAndSelectVersion,
        {
          segmentId: args.segmentId,
          userId: story.userId,
          prompt: finalPrompt,

          image: storageId,
          previewImage: previewStorageId,
          source: "ai_generated",
        },
      );

      await ctx.scheduler.runAfter(
        0,
        internal.media.generateEmbeddingForImage,
        {
          imageVersionId: newImageVersionId,
        },
      );

      return true;
    } catch (err) {
      const error = err as Error;
      console.error(
        `[ACTION FAILED] regenerateSegmentImageUsingPrompt for segment ${args.segmentId}: ${error.message}`,
      );
      await ctx.runMutation(internal.segments.updateSegmentStatus, {
        segmentId: args.segmentId,
        isGenerating: false,
        error: error.message,
      });
      return false;
    }
  },
});

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

      const enhancedStyle = story.stylePrompt
        ? await getEnhancedStylePrompt(story.stylePrompt)
        : undefined;

      const finalPrompt = await getEditingPrompt(
        args.originalPrompt,
        args.newInstruction,
        enhancedStyle,
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

      const isVertical = story.format === "vertical";
      const width = isVertical ? 1080 : 1920;
      const height = isVertical ? 1920 : 1080;

      if (image.width < width || image.height < height) {
        console.log(`Upscaling...`);
        const upscalerOutput = (await replicate.run(
          "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
          { input: { image: newImageUrl, scale: 2 } },
        )) as unknown as string;
        const upscaledResponse = await fetch(upscalerOutput);
        const upscaledArrayBuffer = await upscaledResponse.arrayBuffer();
        image = await Jimp.read(upscaledArrayBuffer);
      }

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

      const newImageVersionId = await ctx.runMutation(
        internal.imageVersions.createAndSelectVersion,
        {
          segmentId: args.segmentId,
          userId: story.userId,
          prompt: finalPrompt,
          image: storageId,
          previewImage: previewStorageId,
          source: "ai_edited",
        },
      );

      await ctx.scheduler.runAfter(
        0,
        internal.media.generateEmbeddingForImage,
        {
          imageVersionId: newImageVersionId,
        },
      );
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

// =================================================================
// >> Section 3: Video Generation Actions (No changes)
// =================================================================

const getAspectRatio = (format?: string) => {
  switch (format) {
    case "horizontal":
      return "16:9";
    case "vertical":
      return "9:16";
    default:
      return "16:9";
  }
};

export const generateImageToVideoClip = internalAction({
  args: {
    segmentId: v.id("segments"),
    userId: v.id("users"),
    imageVersionId: v.id("imageVersions"),
    generationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let videoClipVersionId: Id<"videoClipVersions"> | null = null;
    try {
      const data = await ctx.runQuery(
        internal.segments.getImageToVideoGenerationData,
        {
          segmentId: args.segmentId,
          imageVersionId: args.imageVersionId,
        },
      );
      const videoPrompt = await generateVideoPrompt(
        data.segmentText,
        data.storyStyle,
      );
      videoClipVersionId = await ctx.runMutation(
        internal.segments.createVideoClipVersion,
        {
          segmentId: args.segmentId,
          userId: args.userId,
          generationId: args.generationId,
          context: {
            type: "image_to_video",
            sourceImageId: args.imageVersionId,
            prompt: videoPrompt,
          },
        },
      );
      const output = await replicate.run("kwaivgi/kling-v2.1", {
        input: {
          prompt: videoPrompt,
          start_image: data.imageUrl,
          mode: "standard",
          duration: 5,
          negative_prompt: "low quality, bad quality, blurry, cgi, fake",
        },
      });
      const videoUrl = Array.isArray(output) ? output[0] : String(output);
      if (!videoUrl || typeof videoUrl !== "string") {
        console.error("Replicate API response:", output);
        throw new Error("Replicate did not return a valid video URL.");
      }
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(
          `Failed to fetch video from Replicate URL: ${videoResponse.statusText}`,
        );
      }
      const videoBlob = await videoResponse.blob();
      const videoStorageId = await ctx.storage.store(videoBlob);
      await ctx.runMutation(internal.segments.updateVideoClipVersion, {
        videoClipVersionId,
        storageId: videoStorageId,
        generationStatus: "generated",
      });
      await ctx.runMutation(internal.segments.internalLinkVideoToSegment, {
        segmentId: args.segmentId,
        videoClipVersionId: videoClipVersionId,
      });
      // [FIXED] Call with the correct argument name: `clipId`
      await ctx.scheduler.runAfter(
        0,
        internal.videoProcessing.generateVideoThumbnails,
        {
          clipId: videoClipVersionId,
        },
      );
      await ctx.scheduler.runAfter(
        0,
        internal.media.generateEmbeddingForVideo,
        {
          videoClipVersionId: videoClipVersionId,
        },
      );
      return { success: true };
    } catch (error: any) {
      console.error(
        `Image-to-video generation failed for segment ${args.segmentId}:`,
        error,
      );
      if (videoClipVersionId) {
        await ctx.runMutation(internal.segments.updateVideoClipVersion, {
          videoClipVersionId,
          generationStatus: "error",
          statusMessage: error.message,
        });
      }
      await ctx.runMutation(internal.segments.updateSegmentStatus, {
        segmentId: args.segmentId,
        isGenerating: false,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  },
});

export const generateTextToVideoClip = internalAction({
  args: {
    segmentId: v.id("segments"),
    userId: v.id("users"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const videoModel = process.env.VIDEO_MODEL ?? "fal";
    console.log(`Using video model: ${videoModel}`);
    let videoClipVersionId: Id<"videoClipVersions"> | null = null;
    try {
      videoClipVersionId = await ctx.runMutation(
        internal.segments.createVideoClipVersion,
        {
          segmentId: args.segmentId,
          userId: args.userId,
          context: {
            type: "text_to_video",
            prompt: args.prompt,
          },
        },
      );
      let videoStorageId: Id<"_storage">;
      if (videoModel === "fal") {
        if (!process.env.FAL_KEY) throw new Error("FAL_KEY not set.");
        const output = await fal.subscribe(
          "fal-ai/minimax/hailuo-02/standard/text-to-video",
          {
            input: {
              prompt: args.prompt,
              duration: "6",
              prompt_optimizer: true,
            },
            logs: true,
            onQueueUpdate: (update) => {
              if (update.status === "IN_PROGRESS" && update.logs) {
                update.logs.forEach((log) => console.log(log.message));
              }
            },
          },
        );
        const videoUrl = (output as any).data?.video?.url;
        if (!videoUrl) {
          console.error("Fal.ai API response:", output);
          throw new Error("Fal.ai did not return a valid video URL.");
        }
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
          throw new Error("Failed to fetch video from Fal.ai URL.");
        }
        const video = await videoResponse.blob();
        videoStorageId = await ctx.storage.store(video);
      } else {
        const segment = await ctx.runQuery(
          internal.segments.getSegmentInternal,
          {
            segmentId: args.segmentId,
          },
        );
        if (!segment)
          throw new Error("Segment not found for text-to-video generation.");
        const story = await ctx.runQuery(internal.story.getStoryInternal, {
          storyId: segment.storyId,
        });
        if (!story)
          throw new Error("Story not found for text-to-video generation.");
        const output = await replicate.run("google/veo-3", {
          input: {
            prompt: args.prompt,
            aspect_ratio: getAspectRatio(story.format),
          },
        });
        const videoUrl = Array.isArray(output) ? output[0] : String(output);
        if (!videoUrl || typeof videoUrl !== "string") {
          console.error("Replicate API response:", output);
          throw new Error("Replicate did not return a valid video URL.");
        }
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
          throw new Error(
            `Failed to fetch video from Replicate URL: ${videoResponse.statusText}`,
          );
        }
        const videoBlob = await videoResponse.blob();
        videoStorageId = await ctx.storage.store(videoBlob);
      }
      await ctx.runMutation(internal.segments.updateVideoClipVersion, {
        videoClipVersionId,
        storageId: videoStorageId,
        generationStatus: "generated",
      });
      await ctx.runMutation(internal.segments.internalLinkVideoToSegment, {
        segmentId: args.segmentId,
        videoClipVersionId: videoClipVersionId,
      });
      // [FIXED] Call with the correct argument name: `clipId`
      await ctx.scheduler.runAfter(
        0,
        internal.videoProcessing.generateVideoThumbnails,
        {
          clipId: videoClipVersionId,
        },
      );
      await ctx.scheduler.runAfter(
        0,
        internal.media.generateEmbeddingForVideo,
        {
          videoClipVersionId: videoClipVersionId,
        },
      );
      return { success: true };
    } catch (error: any) {
      console.error(
        `Text-to-video generation failed for segment ${args.segmentId}:`,
        error,
      );
      if (videoClipVersionId) {
        await ctx.runMutation(internal.segments.updateVideoClipVersion, {
          videoClipVersionId,
          generationStatus: "error",
          statusMessage: error.message,
        });
      }
      await ctx.runMutation(internal.segments.updateSegmentStatus, {
        segmentId: args.segmentId,
        isGenerating: false,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  },
});

export const generateTransitionClip = internalAction({
  args: {
    userId: v.id("users"),
    videoClipVersionId: v.id("videoClipVersions"),
  },
  handler: async (ctx, args) => {
    const videoClipVersionId = args.videoClipVersionId;
    try {
      const videoClipVersion = await ctx.runQuery(
        internal.segments.getVideoClipVersionInternal,
        { versionId: videoClipVersionId }, // [FIX] Correct argument name
      );
      if (!videoClipVersion) {
        throw new Error(`VideoClipVersion ${videoClipVersionId} not found.`);
      }
      if (videoClipVersion.context.type !== "transition") {
        throw new Error(`VideoClipVersion is not a transition type.`);
      }
      const {
        startImageId,
        endImageId,
        prompt: transitionInstruction,
      } = videoClipVersion.context;

      const startImageData = await ctx.runQuery(
        internal.segments.getImageToVideoGenerationData,
        {
          segmentId: videoClipVersion.segmentId,
          imageVersionId: startImageId,
        },
      );
      const endImageVersion = await ctx.runQuery(
        internal.imageVersions.getVersionInternal,
        { versionId: endImageId },
      );
      if (!endImageVersion) throw new Error("End image version not found.");

      const endImageUrl = await ctx.storage.getUrl(endImageVersion.image);
      if (!endImageUrl) {
        throw new Error(`URL for end image ${endImageId} not found.`);
      }

      const finalPrompt = await generateTransitionPrompt(
        startImageData.imagePrompt,
        endImageVersion.prompt,
        transitionInstruction,
      );

      // [REPLACED] Use the new model with start and end frames
      const output = await replicate.run("kwaivgi/kling-v1.6-pro", {
        input: {
          prompt: finalPrompt,
          start_image: startImageData.imageUrl,
          end_image: endImageUrl,
          duration: 5,
          negative_prompt: "low quality, bad quality, blurry, cgi, fake",
        },
      });

      const videoUrl = Array.isArray(output) ? output[0] : String(output);
      if (!videoUrl || typeof videoUrl !== "string") {
        console.error("Replicate API response:", output);
        throw new Error("Replicate did not return a valid video URL.");
      }
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(
          `Failed to fetch video from Replicate URL: ${videoResponse.statusText}`,
        );
      }
      const videoBlob = await videoResponse.blob();
      const videoStorageId = await ctx.storage.store(videoBlob);

      await ctx.runMutation(internal.segments.updateVideoClipVersion, {
        videoClipVersionId,
        storageId: videoStorageId,
        generationStatus: "generated",
      });

      // [FIXED] Call with the correct argument name: `clipId`
      await ctx.scheduler.runAfter(
        0,
        internal.videoProcessing.generateVideoThumbnails,
        {
          clipId: videoClipVersionId,
        },
      );

      await ctx.scheduler.runAfter(
        0,
        internal.media.generateEmbeddingForVideo,
        {
          videoClipVersionId: videoClipVersionId,
        },
      );

      return { success: true };
    } catch (error: any) {
      console.error(
        `Transition generation failed for clip ${videoClipVersionId}:`,
        error,
      );
      if (videoClipVersionId) {
        await ctx.runMutation(internal.segments.updateVideoClipVersion, {
          videoClipVersionId,
          generationStatus: "error",
          statusMessage: error.message,
        });
      }
      return { success: false, error: error.message };
    }
  },
});
