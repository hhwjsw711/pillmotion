import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import * as ConversationParticipants from "./model";

export const updateParticipantStatus = internalMutation({
  args: {
    participantId: v.id("conversationParticipants"),
    status: v.union(v.literal("thinking"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.participantId, {
      status: args.status,
    });
    return null;
  },
});

export const addAgentIfNotAlreadyJoined = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const participant =
      await ConversationParticipants.findParticipantByConversationIdAndIdentifier(
        ctx.db,
        {
          conversationId: args.conversationId,
          identifier: {
            kind: "agent",
            agentId: args.agentId,
          },
        },
      );

    if (participant && participant.isRemoved == false) return participant;

    const participantId =
      await ConversationParticipants.addAgentAndSendJoinMessage(ctx.db, {
        conversationId: args.conversationId,
        agentId: args.agentId,
      });

    return ConversationParticipants.getParticipant(ctx.db, {
      participantId: participantId,
    });
  },
});
