import { v } from "convex/values";
import { mutation } from "../_generated/server";
import * as Conversations from "../conversations/model";
import * as Messages from "./model";

export const sendFromMe = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await Conversations.ensureICanAccessConversation(ctx, {
      conversationId: args.conversationId,
    });
    return Messages.addMessageToConversationFromMe(ctx, args);
  },
});
