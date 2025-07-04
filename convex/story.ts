import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getStoryInternal = internalQuery({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.storyId);
  },
});

export const updateStory = internalMutation({
  args: {
    storyId: v.id("story"),
    script: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    ),
    context: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { storyId, ...updates } = args;

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(storyId, filteredUpdates);
    }
  },
});
