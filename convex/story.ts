import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getStoryInternal = internalQuery({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.storyId);
  },
});

export const updateStoryContext = internalMutation({
  args: { storyId: v.id("story"), context: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.storyId, { context: args.context });
  },
});
