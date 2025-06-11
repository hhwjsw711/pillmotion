import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { CREDIT_COSTS } from "./schema";
import OpenAI from "openai";
import { Id } from "./_generated/dataModel";

const openai = new OpenAI();

function getSystemPrompt(context?: string) {
  let styleInstructions = "A vibrant, cinematic anime style.";
  if (context) {
    try {
      const parsedContext = JSON.parse(context);
      const sb = parsedContext.style_bible;
      if (sb) {
        styleInstructions = `${sb.visual_theme}, in a ${sb.mood} mood. The color palette is dominated by ${sb.color_palette}, with ${sb.lighting_style}. Characters should look like ${sb.character_design}, and environments like ${sb.environment_design}.`;
      }
    } catch (e) {
      console.warn(
        "Failed to parse context for style instructions. Using default style.",
        e,
      );
    }
  }

  return `You are an expert prompt engineer for text-to-image models...
        Your job is to take a segment of a story and expand it into a detailed, descriptive prompt.
        
        **STYLE CONTEXT**: The overall visual style is strictly defined as: "${styleInstructions}"
        You must adhere to this style.

        **SCENE DESCRIPTION**: The specific scene to illustrate is:
        
        Your task is to merge the STYLE CONTEXT with the SCENE DESCRIPTION into a single, fluid paragraph. Focus on character actions, emotions, and environment.
        
        **TECHNICAL REQUIREMENTS**:
        - Include photographic terms: camera angle (e.g., low-angle shot), lens type (e.g., wide-angle), lighting (e.g., volumetric lighting).
        - **Avoid clichés**: Do not use generic or lazy phrases.
        - **Negative Prompt Hints**: Implicitly avoid ugly, deformed, blurry, or low-quality results. Ensure anatomical correctness.
        
        Output ONLY a JSON object with the key "prompt".`;
}

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
