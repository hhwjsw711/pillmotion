import {
  mutation,
  query,
  internalAction,
  internalMutation,
  MutationCtx,
  QueryCtx,
  internalQuery,
} from "./_generated/server";
import { prosemirrorSync } from "./prosemirror";
import { auth } from "./auth";
import { ConvexError, v } from "convex/values";
import {
  storyFormatValidator,
  storyStatusValidator,
  CREDIT_COSTS,
} from "./schema";
import { internal } from "./_generated/api";
import { consumeCreditsHelper } from "./credits";
import OpenAI from "openai";
import { Id } from "./_generated/dataModel";

const openai = new OpenAI();

async function verifyStoryOwnerHelper(
  ctx: MutationCtx | QueryCtx,
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

export const list = query({
  args: {
    status: v.optional(storyStatusValidator),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }
    const query = args.status
      ? ctx.db
          .query("story")
          .withIndex("by_user_status", (q) =>
            q.eq("userId", userId).eq("status", args.status),
          )
      : ctx.db
          .query("story")
          .withIndex("userId", (q) => q.eq("userId", userId));

    return query.order("desc").collect();
  },
});

export const createStory = mutation({
  args: {
    title: v.optional(v.string()),
    script: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized operation");
    }

    const storyId = await ctx.db.insert("story", {
      updatedAt: Date.now(),
      userId,
      title: args.title ?? "新故事",
      script: args.script ?? "",
      status: "draft",
      generationStatus: "idle",
    });

    return storyId;
  },
});

export const initializeEditor = mutation({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    await verifyStoryOwnerHelper(ctx, args.storyId);
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");

    const scriptText = story.script || "";
    const paragraphs = scriptText
      .split("\n")
      .filter((p) => p.trim() !== "")
      .map((pText) => ({
        type: "paragraph",
        content: [{ type: "text", text: pText }],
      }));

    const initialContent =
      paragraphs.length > 0 ? paragraphs : [{ type: "paragraph", content: [] }];

    await prosemirrorSync.create(ctx, args.storyId, {
      type: "doc",
      content: initialContent,
    });
  },
});

export const updateStoryFormat = mutation({
  args: {
    storyId: v.id("story"),
    format: storyFormatValidator,
  },
  handler: async (ctx, args) => {
    await verifyStoryOwnerHelper(ctx, args.storyId);
    await ctx.db.patch(args.storyId, { format: args.format });
  },
});

export const getStory = query({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    const { story } = await verifyStoryOwnerHelper(ctx, args.storyId);
    return story;
  },
});

export const updateStoryTitle = mutation({
  args: {
    storyId: v.id("story"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyStoryOwnerHelper(ctx, args.storyId);
    await ctx.db.patch(args.storyId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

export const deleteStory = mutation({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    await verifyStoryOwnerHelper(ctx, args.storyId);
    await ctx.db.delete(args.storyId);
  },
});

export const generateSegments = mutation({
  args: {
    storyId: v.id("story"),
    format: storyFormatValidator,
  },
  handler: async (ctx, args) => {
    const { storyId, format } = args;

    const { story, userId } = await verifyStoryOwnerHelper(ctx, storyId);

    await ctx.db.patch(storyId, { format });

    await consumeCreditsHelper(ctx, userId, CREDIT_COSTS.CHAT_COMPLETION);

    await ctx.scheduler.runAfter(0, internal.story.generateSegmentsAction, {
      storyId,
      script: story.script,
      userId: userId,
    });
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

    const segments = args.script.split(/\n{2,}/).filter((s) => s.trim() !== "");

    await ctx.runMutation(internal.story.updateStoryContext, {
      storyId: args.storyId,
      context,
    });

    for (let i = 0; i < segments.length; i++) {
      await ctx.runMutation(internal.segments.createSegmentWithImageInternal, {
        storyId: args.storyId,
        text: segments[i],
        order: i,
        context: context,
        userId: args.userId,
      });
    }
  },
});

export const updateStoryContext = internalMutation({
  args: {
    storyId: v.id("story"),
    context: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.storyId, { context: args.context });
  },
});

async function generateContext(script: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          'You are a top-tier art director for a film studio. Your task is to read the provided script and generate a "Style Bible" in a JSON format. This bible will guide all visual production. Do not output anything besides the JSON object. The JSON object must contain these keys: "visual_theme", "mood", "color_palette", "lighting_style", "character_design", "environment_design".',
      },
      {
        role: "user",
        content: script,
      },
    ],
    max_tokens: 400,
    response_format: { type: "json_object" },
  });
  const context = completion.choices[0].message.content;
  if (!context) throw new Error("Failed to generate context from OpenAI.");
  return context;
}

export const getStoryInternal = internalQuery({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.storyId);
  },
});
