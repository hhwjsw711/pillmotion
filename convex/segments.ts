import { v } from "convex/values";
import {
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { consumeCreditsHelper } from "./credits";
import { CREDIT_COSTS } from "./schema";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

export const createSegmentWithImageInternal = internalMutation({
  args: {
    userId: v.id("users"),
    storyId: v.id("story"),
    text: v.string(),
    order: v.number(),
    context: v.string(),
  },
  async handler(ctx, args) {
    const segmentId = await ctx.db.insert("segments", {
      storyId: args.storyId,
      text: args.text,
      order: args.order,
      isGenerating: true,
    });

    await consumeCreditsHelper(ctx, args.userId, CREDIT_COSTS.IMAGE_GENERATION);

    await ctx.scheduler.runAfter(
      0,
      internal.segments.generateSegmentImageReplicateInternal,
      {
        segment: {
          text: args.text,
          _id: segmentId,
        },
        context: args.context,
      },
    );
  },
});

export const generateSegmentImageReplicateInternal = internalAction({
  args: {
    context: v.optional(v.string()),
    segment: v.object({
      text: v.string(),
      _id: v.id("segments"),
    }),
  },
  async handler(ctx, args) {
    try {
      const prompt = await openai.chat.completions
        .create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: getSystemPrompt(args.context),
            },
            { role: "user", content: args.segment.text },
          ],
          response_format: zodResponseFormat(
            z.object({ prompt: z.string() }),
            "prompt",
          ),
        })
        .then((completions) => {
          const content = completions.choices[0].message.content as string;
          return JSON.parse(content).prompt as string;
        });

      await ctx.scheduler.runAfter(
        0,
        internal.replicate.regenerateSegmentImageUsingPrompt,
        {
          segmentId: args.segment._id,
          prompt,
        },
      );
    } catch (error) {
      console.error("Error generating segment image prompt:", error);
      await ctx.runMutation(internal.segments.updateSegment, {
        segmentId: args.segment._id,
        isGenerating: false,
        error: (error as Error).message,
      });
    }
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
    image: v.optional(v.id("_storage")),
    previewImage: v.optional(v.id("_storage")),
    prompt: v.optional(v.string()),
    isGenerating: v.optional(v.boolean()),
    error: v.optional(v.string()),
    text: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const { segmentId, ...updates } = args;

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(segmentId, filteredUpdates);
    }

    return await ctx.db.get(segmentId);
  },
});

function getSystemPrompt(context?: string): string {
  return `You are a professional image prompt engineer.
  Create a detailed, descriptive prompt for AI image generation based on the given text passage.
  The prompt should capture the scenes, characters, emotions, and atmosphere described in the text to generate high-quality matching images.
  
  ${context ? `Context for the entire story:\n${context}\n\n` : ""}
  
  Please follow these guidelines:
  1. Keep the prompt between 50-100 words
  2. Include clear scene descriptions and visual elements
  3. Maintain consistency with the overall story style and atmosphere
  4. Don't add elements not mentioned in the story
  5. Focus on visual content, avoid abstract concepts
  
  Return your response in JSON format with only a "prompt" field, for example: {"prompt": "your image prompt"}`;
}
