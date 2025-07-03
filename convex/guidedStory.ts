import { ConvexError, v } from "convex/values";
import {
  mutation,
  internalAction,
  internalMutation,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { auth } from "./auth";
import { consumeCreditsHelper } from "./credits";
import { internal } from "./_generated/api";
import { CREDIT_COSTS } from "./schema";
import OpenAI from "openai";
import { Id } from "./_generated/dataModel";

const openai = new OpenAI();

export const generateGuidedStoryMutation = mutation({
  args: {
    title: v.string(),
    description: v.string(),
  },
  async handler(ctx, args) {
    const userId = await auth.getUserId(ctx);
    if (userId === null) {
      throw new Error("User is not logged in");
    }

    await consumeCreditsHelper(ctx, userId, CREDIT_COSTS.CHAT_COMPLETION);

    const storyId = await ctx.db.insert("story", {
      title: args.title,
      userId: userId,
      script: "",
      status: "processing",
    });

    await ctx.scheduler.runAfter(
      0,
      internal.guidedStory.generateGuidedStoryAction,
      {
        storyId,
        description: args.description,
        userId,
      },
    );

    return storyId;
  },
});

export const generateGuidedStoryAction = internalAction({
  args: {
    storyId: v.id("story"),
    description: v.string(),
    userId: v.id("users"),
  },
  async handler(ctx, args) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional writer tasked with creating a short story for a voice over based on a given description. The story should be a story that is 10,000 characters max length. DO NOT TITLE ANY SEGMENT. JUST RETURN THE TEXT OF THE ENTIRE STORY. THIS IS FOR A VOICE OVER, ONLY INCLUDE THE SPOKEN WORDS.",
        },
        { role: "user", content: args.description },
      ],
      temperature: 0.8,
    });

    const story = response.choices[0].message.content;
    if (!story) throw new Error("Failed to generate story");

    await ctx.runMutation(internal.guidedStory.updateStoryScript, {
      storyId: args.storyId,
      script: story,
      status: "completed",
    });
  },
});

export const updateStoryScript = internalMutation({
  args: {
    storyId: v.id("story"),
    script: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("processing"),
      v.literal("completed"),
    ),
  },
  handler: async (ctx, args) => {
    const { storyId, script, status } = args;
    await ctx.db.patch(storyId, {
      script,
      status,
    });
  },
});

export const generateSegmentsMutation = mutation({
  args: {
    storyId: v.id("story"),
    isVertical: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { storyId, isVertical } = args;

    const accessObj = await verifyStoryOwnerHelper(ctx, storyId);
    if (!accessObj) throw new Error("You don't have access to this story");

    const story = accessObj.story;

    await ctx.db.patch(storyId, { isVertical });

    await consumeCreditsHelper(
      ctx,
      accessObj.userId,
      CREDIT_COSTS.CHAT_COMPLETION,
    );

    await ctx.scheduler.runAfter(
      0,
      internal.guidedStory.generateSegmentsAction,
      {
        storyId,
        script: story.script,
        userId: accessObj.userId,
      },
    );
  },
});

export const generateSegmentsAction = internalAction({
  args: {
    storyId: v.id("story"),
    script: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const context = await generateContext(args.script);
    if (!context) throw new Error("Failed to generate context");

    const segments = args.script.split(/\n{2,}/);

    await ctx.runMutation(internal.story.updateStoryContext, {
      storyId: args.storyId,
      context,
    });

    for (let i = 0; i < segments.length; i++) {
      await ctx.runMutation(internal.segments.createSegmentWithImageInternal, {
        storyId: args.storyId,
        text: segments[i],
        order: i,
        context,
        userId: args.userId,
      });
    }
  },
});

export async function verifyStoryOwnerHelper(
  ctx: QueryCtx | MutationCtx,
  storyId: Id<"story">,
) {
  const userId = await auth.getUserId(ctx);
  if (!userId) {
    throw new ConvexError("User not authenticated.");
  }
  const story = await ctx.db.get(storyId);
  if (!story) {
    throw new ConvexError("Story not found.");
  }
  if (story.userId !== userId) {
    throw new ConvexError("User is not the owner of this story.");
  }
  return { story, userId };
}

async function generateContext(script: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional literary analyst. Analyze the provided story and extract its main themes, characters, emotions, atmosphere, setting, and visual style. " +
            "Create a concise contextual description to guide image generation for each paragraph of the story. " +
            "Your description should highlight the visual style, tone, and overall aesthetics of the story to ensure consistency across images. " +
            "Limit your response to 300 words, focusing on elements that would be helpful for image generation.",
        },
        { role: "user", content: script },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error generating context:", error);
    return "";
  }
}
