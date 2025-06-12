import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { CREDIT_COSTS } from "./schema";
import OpenAI from "openai";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

const openai = new OpenAI();

function getSystemPrompt(context?: string) {
  // The base style instructions, if context is missing.
  const defaultStyle = "A vibrant, cinematic anime style.";
  // We will pass the raw context JSON directly to the model.
  const contextString =
    context || `{"style_bible": {"visual_theme": "${defaultStyle}"}}`;

  return `You are an expert prompt engineer for text-to-image models. Your mission is to generate a high-quality, detailed image prompt **IN ENGLISH**.

You will be given a "Style Bible" and a "Scene Description". Both might be in a language other than English. You must first understand their meaning and then synthesize them into a single, cohesive, and descriptive prompt for an image generation model.

**IMPORTANT RULES**:
1.  **Output Language**: The final output prompt inside the JSON object MUST be in **ENGLISH**.
2.  **Synthesize, Don't Just Translate**: Do not just literally translate the words. Understand the artistic direction from the Style Bible and the narrative moment from the Scene Description, and combine them into a powerful visual instruction.
3.  **Technical Details**: Incorporate advanced photographic and artistic terms into the English prompt (e.g., "cinematic lighting," "low-angle shot," "dynamic composition," "hyper-detailed," "Unreal Engine 5 render").
4.  **Adherence**: Strictly adhere to the visual and thematic elements described in the Style Bible.
5.  **Output Format**: Respond with ONLY a single JSON object with one key: "prompt". The value of "prompt" should be the final, English-language image prompt.

**STYLE BIBLE (JSON)**:
${contextString}

**SCENE DESCRIPTION (Text)**:
The scene to illustrate will be provided in the user message.
`;
}

export const updateSegmentText = mutation({
  args: {
    segmentId: v.id("segments"),
    text: v.string(),
  },
  async handler(ctx, args) {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated.");
    }

    const segment = await ctx.db.get(args.segmentId);
    if (!segment) {
      throw new Error("Segment not found.");
    }

    const story = await ctx.db.get(segment.storyId);
    if (!story) {
      throw new Error("Associated story not found.");
    }

    if (story.userId !== userId) {
      throw new Error("User is not authorized to edit this segment.");
    }

    await ctx.db.patch(args.segmentId, { text: args.text });
  },
});

export const generateAndCreateSegment = internalAction({
  args: {
    userId: v.id("users"),
    storyId: v.id("story"),
    text: v.string(),
    order: v.number(),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    let segmentId: Id<"segments"> | null = null;
    try {
      // Create the segment entry first to make it visible in the UI
      segmentId = await ctx.runMutation(internal.segments.createSegment, {
        storyId: args.storyId,
        text: args.text,
        order: args.order,
      });

      await ctx.runMutation(internal.credits.consumeCredits, {
        userId: args.userId,
        cost: CREDIT_COSTS.IMAGE_GENERATION,
      });

      // Generate the prompt
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: getSystemPrompt(args.context) },
          { role: "user", content: args.text },
        ],
        response_format: { type: "json_object" },
      });
      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error("OpenAI did not return content for prompt generation.");
      }
      const prompt = JSON.parse(content).prompt;

      // Generate the image and update the segment
      await ctx.runAction(
        internal.replicate.regenerateSegmentImageUsingPrompt,
        {
          segmentId,
          prompt,
        },
      );

      return { success: true };
    } catch (error: any) {
      console.error("Failed to generate segment:", error);
      if (segmentId) {
        await ctx.runMutation(internal.segments.updateSegment, {
          segmentId,
          isGenerating: false,
          error: error.message || "Unknown error",
        });
      }
      return { success: false, error: error.message };
    }
  },
});

export const createSegment = internalMutation({
  args: {
    storyId: v.id("story"),
    text: v.string(),
    order: v.number(),
  },
  async handler(ctx, args) {
    return await ctx.db.insert("segments", {
      storyId: args.storyId,
      text: args.text,
      order: args.order,
      isGenerating: true,
    });
  },
});

export const get = query({
  args: { id: v.id("segments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByStory = query({
  args: { storyId: v.id("story") },
  async handler(ctx, args) {
    return await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) => q.eq("storyId", args.storyId))
      .collect();
  },
});

export const getSegmentInternal = internalQuery({
  args: { segmentId: v.id("segments") },
  async handler(ctx, args) {
    return await ctx.db.get(args.segmentId);
  },
});

export const updateSegment = internalMutation({
  args: {
    segmentId: v.id("segments"),
    isGenerating: v.optional(v.boolean()),
    image: v.optional(v.id("_storage")),
    previewImage: v.optional(v.id("_storage")),
    prompt: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const { segmentId, ...rest } = args;
    await ctx.db.patch(segmentId, rest);
  },
});
