import { mutation } from "../_generated/server";
import { v } from "convex/values";
import * as Conversations from "./model";

export const create = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => Conversations.createConversation(ctx, args),
});

export const updateMine = mutation({
  args: {
    conversationId: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => Conversations.updateMine(ctx, args),
});

export const removeMine = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => Conversations.removeMine(ctx, args),
});
