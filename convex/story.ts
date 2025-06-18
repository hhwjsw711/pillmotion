import { mutation, MutationCtx, QueryCtx, query } from "./_generated/server";
import { auth } from "./auth";
import { ConvexError, v } from "convex/values";
import { prosemirrorSync } from "./prosemirror";
import { Id } from "./_generated/dataModel";

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

export const createStory = mutation({
  args: {
    title: v.string(),
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
      title: args.title,
      script: args.script ?? "",
      status: "draft",
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

export const getStory = query({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    const { story } = await verifyStoryOwnerHelper(ctx, args.storyId);
    return story;
  },
});
