import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import * as Messages from "./model";
import * as ConversationParticipants from "../conversationParticipants/model";
import { ensureFP } from "../../shared/ensure";
import { pick } from "convex-helpers";
import { exhaustiveCheck } from "../../shared/misc";

export const listMessages = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    return await Messages.listMessages(ctx.db, {
      conversationId: args.conversationId,
      limit: args.count,
    });
  },
});

export const listMessagesHistoryForAgentGeneration = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await Messages.listMessages(ctx.db, {
      conversationId: args.conversationId,
      limit: args.count,
      kind: "participant",
    });

    const messagesWithAuthorDetails = await Promise.all(
      messages
        .filter((m) => m.kind == "participant")
        .map(async (message) => {
          const userOrAgent =
            await ConversationParticipants.getParticipantUserOrAgent(ctx.db, {
              participantId: message.authorParticipantId,
            });

          if (userOrAgent.kind == "agent")
            return {
              message,
              author: {
                ...pick(userOrAgent.agent, ["name", "_id"]),
                kind: "agent",
              } as const,
            };

          if (userOrAgent.kind == "user")
            return {
              message,
              author: {
                ...pick(userOrAgent.user, ["name", "_id"]),
                kind: "user",
              } as const,
            };

          exhaustiveCheck(userOrAgent);
        }),
    );

    return messagesWithAuthorDetails;
  },
});

export const getMessageAuthor = internalQuery({
  args: {
    messageId: v.id("conversationMessages"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId).then(ensureFP());
    if (message.kind == "system")
      throw new Error("Message is a system message");
    return await ConversationParticipants.getParticipantUserOrAgent(ctx.db, {
      participantId: message.authorParticipantId,
    });
  },
});
