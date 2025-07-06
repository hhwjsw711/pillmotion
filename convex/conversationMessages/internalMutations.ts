import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import * as Messages from "./model";
import * as Agents from "../agents/model";
import * as ConversationParticipants from "../conversationParticipants/model";

export const sendFromTriageAgent = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  returns: v.id("conversationMessages"),
  handler: async (ctx, args) => {
    const triageAgent = await Agents.getTriageAgent(ctx.db);

    const triageAgentParticipant =
      await ConversationParticipants.getParticipantByConversationIdAndIdentifier(
        ctx.db,
        {
          conversationId: args.conversationId,
          identifier: {
            kind: "agent",
            agentId: triageAgent._id,
          },
        },
      );

    const messageId = await Messages.addMessageToConversationFromAgent(ctx, {
      conversationId: args.conversationId,
      content: args.content,
      agentId: triageAgent._id,
      authorParticipantId: triageAgentParticipant._id,
    });

    return messageId;
  },
});

export const sendFromAgent = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    agentId: v.id("agents"),
    content: v.string(),
    authorParticipantId: v.id("conversationParticipants"),
  },
  returns: v.id("conversationMessages"),
  handler: async (ctx, args) => {
    return await Messages.addMessageToConversationFromAgent(ctx, args);
  },
});

export const sendSystemMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    meta: v.optional(v.any()),
  },
  returns: v.id("conversationMessages"),
  handler: async (ctx, args) => {
    return await Messages.addMessageToConversationFromSystem(ctx.db, args);
  },
});
