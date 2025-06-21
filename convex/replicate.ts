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

async function generateVideoPrompt(
  sceneText: string,
  styleGuide: string | undefined,
) {
  const systemPrompt = `You are an expert film director and cinematographer. Your task is to convert a simple narrative scene description into a rich, detailed, and actionable prompt for a text-to-video AI model.

The final prompt must be in ENGLISH and should be a single, comma-separated string of descriptive phrases.

You will be given the original narrative text in <SceneText> tags and an overall style guide in <StyleGuide> tags.

**Your prompt MUST describe:**
1.  **Cinematography**: Specify the shot type (e.g., wide shot, medium close-up, aerial shot) and camera movement (e.g., static, slow pan, tracking shot, dolly zoom, handheld).
2.  **Subject & Action**: Clearly describe the main character(s) and their specific actions.
3.  **Environment**: Detail the setting, lighting, and overall mood.

**Example 1:**
- Input:
<SceneText>A princess lived in a castle.</SceneText>
<StyleGuide>Ghibli style</StyleGuide>
- Your Output: Ghibli style, wide shot of a magnificent castle perched on a hill, a young princess visible in a high tower window, slow panning motion across the landscape, soft morning light, cinematic.

**Example 2:**
- Input:
<SceneText>The knight charged the dragon.</SceneText>
<StyleGuide>Epic fantasy film</StyleGuide>
- Your Output: Epic fantasy film, dynamic low-angle tracking shot, a knight in shining armor charges forward on horseback, a massive dragon rears up ahead breathing fire, dramatic lighting, lens flare.`;

  const userContent = `<SceneText>${sceneText}</SceneText>
<StyleGuide>${styleGuide ?? "General cinematic style"}</StyleGuide>`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
    });
    // Fallback to the original text if the LLM fails to produce a good prompt
    return completion.choices[0]?.message?.content ?? sceneText;
  } catch (error) {
    console.error("Error generating video prompt:", error);
    // Fallback to the original text in case of an error
    return sceneText;
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

export const generateVideoClip = internalAction({
  args: {
    segmentId: v.id("segments"),
    imageVersionId: v.id("imageVersions"),
    videoVersionId: v.optional(v.id("videoVersions")),
  },
  handler: async (ctx, args) => {
    let videoClipVersionId: Id<"videoClipVersions"> | null = null;

    try {
      // 步骤 1: 调用位于 segments.ts 中的 query 来安全地获取数据
      const data = await ctx.runQuery(
        internal.segments.getVideoClipGenerationData,
        {
          segmentId: args.segmentId,
          imageVersionId: args.imageVersionId,
        },
      );

      if (!data.imageVersion.image) {
        throw new Error("Source image version does not have a stored image.");
      }
      const startImageUrl = await ctx.storage.getUrl(data.imageVersion.image);
      if (!startImageUrl) {
        throw new Error("Could not get URL for start image.");
      }

      // 步骤 2: 生成视频 prompt
      const videoPrompt = await generateVideoPrompt(
        data.segmentText,
        data.storyStyle,
      );

      // 步骤 3: 创建一个 videoClipVersion 记录，初始状态为 "generating"
      videoClipVersionId = await ctx.runMutation(
        internal.segments.createVideoClipVersion,
        {
          type: "image-to-video",
          segmentId: args.segmentId,
          userId: data.userId,
          sourceImageVersionId: args.imageVersionId,
          videoVersionId: args.videoVersionId, // 如果是批量任务，这里会有值
          generationStatus: "generating",
          prompt: videoPrompt,
        },
      );

      // 步骤 4: 调用 Replicate API
      const input = {
        prompt: videoPrompt,
        start_image: startImageUrl,
        mode: "standard",
        duration: 5,
        negative_prompt:
          "low quality, bad quality, blurry, pixelated, cgi, fake, unreal, cartoon, drawing, illustration, watermark",
      };
      const output = await replicate.run("kwaivgi/kling-v2.1", { input });

      // ... [校验 output, fetch 视频, 存入 storage 的逻辑保持不变] ...
      const outputUrl = String(output);
      if (!outputUrl || typeof outputUrl !== "string") {
        throw new Error(
          `Replicate did not return a valid URL string. Got: ${outputUrl}`,
        );
      }
      const videoResponse = await fetch(outputUrl);
      if (!videoResponse.ok) {
        throw new Error(
          `Failed to fetch video from Replicate URL: ${videoResponse.statusText}`,
        );
      }
      const videoBuffer = await videoResponse.arrayBuffer();
      const videoStorageId = await ctx.storage.store(
        new Blob([videoBuffer], { type: "video/mp4" }),
      );

      // 步骤 5: 更新记录为 "generated"
      await ctx.runMutation(internal.segments.updateVideoClipVersion, {
        videoClipVersionId,
        storageId: videoStorageId,
        generationStatus: "generated",
      });

      // 步骤 6: 将新生成的视频设置为场景的当前选中版本
      await ctx.runMutation(internal.segments.internalLinkVideoToSegment, {
        segmentId: args.segmentId,
        videoClipVersionId: videoClipVersionId,
      });

      await ctx.scheduler.runAfter(
        0,
        internal.media.generateEmbeddingForVideo,
        {
          videoClipVersionId: videoClipVersionId,
        },
      );

      return { success: true };
    } catch (error: any) {
      const errorMessage =
        error.message || "Unknown error during video clip generation.";
      console.error(
        `Failed to generate video clip for segment ${args.segmentId}:`,
        error,
      );

      // 步骤 7 (Catch): 如果出错，也要更新记录状态
      if (videoClipVersionId) {
        await ctx.runMutation(internal.segments.updateVideoClipVersion, {
          videoClipVersionId,
          generationStatus: "error",
          statusMessage: errorMessage,
        });
      }
      return { success: false, error: errorMessage };
    }
  },
});
