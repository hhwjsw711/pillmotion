import { mutation, query } from "./_generated/server";
import { prosemirrorSync } from "./prosemirror";
import { auth } from "./auth";
import { v } from "convex/values";
import { storyFormatValidator, storyStatusValidator } from "./schema";

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
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("User must be authenticated.");

    const story = await ctx.db.get(args.storyId);
    if (!story || story.userId !== userId) {
      throw new Error("Story not found or user not authorized.");
    }

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
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized operation.");

    const story = await ctx.db.get(args.storyId);
    if (!story || story.userId !== userId) {
      throw new Error("Story not found or user not authorized.");
    }

    await ctx.db.patch(args.storyId, { format: args.format });
  },
});

export const getStory = query({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized operation");
    }

    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }

    if (story.userId !== userId) {
      throw new Error("Unauthorized access");
    }

    return story;
  },
});

export const updateStoryTitle = mutation({
  args: {
    storyId: v.id("story"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized operation");
    }

    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }

    if (story.userId !== userId) {
      throw new Error("Unauthorized access");
    }

    await ctx.db.patch(args.storyId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

export const deleteStory = mutation({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized operation");
    }

    const story = await ctx.db.get(args.storyId);
    if (!story) {
      throw new Error("Story not found");
    }

    if (story.userId !== userId) {
      throw new Error("Unauthorized access");
    }

    await ctx.db.delete(args.storyId);
  },
});
