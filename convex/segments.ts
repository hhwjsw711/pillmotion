import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { consumeCreditsHelper } from "./credits";
import { internal } from "./_generated/api";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { CREDIT_COSTS } from "./schema";
import OpenAI from "openai";

const openai = new OpenAI();

function getSystemPrompt(context?: string) {
  return `You are an expert prompt engineer for text-to-image models like Midjourney or Stable Diffusion.
        CONTEXT: The overall visual style for the story is: ${context || "A vibrant, cinematic anime style."}
        Your job is to take the user's input, which is a segment of a story, and expand it into a detailed, descriptive prompt.
        The prompt must be a single, fluid paragraph. Focus on specifying character actions, emotions, the environment, lighting, and camera details.
        **Crucially, include photographic terms like camera angle (e.g., low-angle shot, aerial view), lens type (e.g., wide-angle, macro), and specific lighting descriptions (e.g., volumetric lighting, rim lighting).**
        Do not output anything other than the JSON object with the "prompt" key.`;
}

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
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: getSystemPrompt(args.context),
        },
        { role: "user", content: args.segment.text },
      ],
      response_format: zodResponseFormat(
        z.object({
          prompt: z.string(),
        }),
        "prompt",
      ),
    });

    const prompt = JSON.parse(
      completion.choices[0].message.content as string,
    ).prompt;

    await ctx.scheduler.runAfter(
      0,
      internal.replicate.regenerateSegmentImageUsingPrompt,
      { segmentId: args.segment._id, prompt },
    );
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
