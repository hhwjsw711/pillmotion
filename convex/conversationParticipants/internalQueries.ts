import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import * as ConversationParticipants from "./model";
import { conversationParticipantIdentifierSchemaValidator } from "./schema";

export const listNonSystemAgentParticipants = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    return await ConversationParticipants.listNonSystemAgentParticipants(
      ctx.db,
      args,
    );
  },
});

export const listNonSystemAgentParticipantsWithJoinedDetails = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const participants =
      await ConversationParticipants.listParticipantsWithJoinedDetails(
        ctx.db,
        args,
      );

    return participants
      .filter((p) => {
        if (p.agent && p.agent.kind == "system_agent") return null;
        return p;
      })
      .filter((p) => p !== null);
  },
});

export const findParticipantByConversationIdAndIdentifier = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    identifier: conversationParticipantIdentifierSchemaValidator,
  },
  handler: async (ctx, args) => {
    return await ConversationParticipants.findParticipantByConversationIdAndIdentifier(
      ctx.db,
      args,
    );
  },
});

export const getParticipantUserOrAgent = internalQuery({
  args: {
    participantId: v.id("conversationParticipants"),
  },
  handler: async (ctx, args) => {
    return await ConversationParticipants.getParticipantUserOrAgent(ctx.db, {
      participantId: args.participantId,
    });
  },
});
