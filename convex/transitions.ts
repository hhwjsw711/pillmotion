import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { transitionTypeValidator } from "./schema";

export const getForStory = query({
  args: {
    storyId: v.id("story"),
  },
  handler: async (ctx, { storyId }) => {
    return await ctx.db
      .query("transitions")
      .withIndex("by_story", (q) => q.eq("storyId", storyId))
      .collect();
  },
});

export const upsertTransition = mutation({
  args: {
    storyId: v.id("story"),
    afterSegmentId: v.id("segments"),
    type: transitionTypeValidator,
    duration: v.number(),
  },
  handler: async (ctx, { storyId, afterSegmentId, type, duration }) => {
    const existingTransition = await ctx.db
      .query("transitions")
      .withIndex("by_afterSegment", (q) => q.eq("afterSegmentId", afterSegmentId))
      .unique();

    if (type === "cut") {
      if (existingTransition) {
        await ctx.db.delete(existingTransition._id);
      }
      return;
    }

    if (existingTransition) {
      await ctx.db.patch(existingTransition._id, { type, duration });
    } else {
      await ctx.db.insert("transitions", {
        storyId,
        afterSegmentId,
        type,
        duration,
      });
    }
  },
});