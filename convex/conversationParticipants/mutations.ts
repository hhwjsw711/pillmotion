import { mutation } from "../_generated/server";
import { v } from "convex/values";
import * as ConversationParticipants from "./model";
import { ensureICanAccessConversation } from "../conversations/model";
import * as ConversationMessages from "../conversationMessages/model";
import { ensureICanAccessAgent } from "../agents/model";

export const addAgent = mutation({
  args: {
    conversationId: v.id("conversations"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, { conversationId, agentId }) => {
    await ensureICanAccessConversation(ctx, { conversationId });
    await ensureICanAccessAgent(ctx, { agentId });
    return ConversationParticipants.addAgentAndSendJoinMessage(ctx.db, {
      conversationId,
      agentId,
    });
  },
});

export const addUser = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, { conversationId, userId }) => {
    await ensureICanAccessConversation(ctx, { conversationId });
    return ConversationParticipants.addUser(ctx.db, { conversationId, userId });
  },
});

export const removeParticipant = mutation({
  args: {
    conversationId: v.id("conversations"),
    participantId: v.id("conversationParticipants"),
  },
  handler: async (ctx, { conversationId, participantId }) => {
    await ensureICanAccessConversation(ctx, { conversationId });

    const participant =
      await ConversationParticipants.getParticipantUserOrAgent(ctx.db, {
        participantId,
      });

    if (participant.kind == "agent" && participant.agent.kind == "system_agent")
      throw new Error("Cannot remove system agent from conversation");

    await ConversationParticipants.removeParticipant(ctx.db, { participantId });

    await ConversationMessages.createParticipantLeftConversationMessage(
      ctx.db,
      {
        conversationId,
        participant,
      },
    );

    return null;
  },
});
