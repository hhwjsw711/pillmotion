import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import * as Conversations from "./model";

export const isTriageAgentJoined = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    return await Conversations.isTriageAgentJoined(ctx.db, args);
  },
});
