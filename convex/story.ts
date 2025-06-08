import { mutation, query } from "./_generated/server";
import { prosemirrorSync } from "./prosemirror";
import { auth } from "./auth";
import { v } from "convex/values";

// 创建 story
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
    });

    await prosemirrorSync.create(ctx, storyId, { type: "doc", content: [] });
    return storyId;
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
      updatedAt: Date.now() // 更新时间戳
    });
  },
});
