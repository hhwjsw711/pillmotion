"use node";

import { internalAction } from "../_generated/server";
import schema from "../schema";
import { triageMessage } from "../ai/triageMessage";
import { doc } from "convex-helpers/validators";
import { agentReplyToMessage } from "../ai/agentReplyToMessage";
import { internal } from "../_generated/api";
import { parseMentionsFromMessageContent } from "../../shared/mentions";

export const processMessage = internalAction({
  args: {
    message: doc(schema, "conversationMessages"),
    conversation: doc(schema, "conversations"),
  },
  handler: async (ctx, args) => {
    // Dont handle system
    if (args.message.kind == "system") return;

    // If there are no references then we should invoke the "triage agent" which will    decide what to do with the message

    console.log(`Processing Message..`, args.message);

    const references = parseMentionsFromMessageContent(args.message.content);

    console.log(`Detected references`, references);

    if (references.length == 0) {
      const author = await ctx.runQuery(
        internal.conversationParticipants.internalQueries
          .getParticipantUserOrAgent,
        { participantId: args.message.authorParticipantId },
      );

      if (author.kind != "user") {
        console.log(`Not triaging agent messages`);
        return;
      }

      await triageMessage(ctx, {
        message: args.message,
        conversation: args.conversation,
        messageAuthor: author,
      });
    }

    // Otherwise we should invoke each agent with the message
    for (const reference of references) {
      if (reference.kind == "agent") {
        const author = await ctx.runQuery(
          internal.conversationParticipants.internalQueries
            .getParticipantUserOrAgent,
          { participantId: args.message.authorParticipantId },
        );
        await agentReplyToMessage(ctx, {
          message: args.message,
          agentId: reference.agentId,
          conversation: args.conversation,
          messageAuthor: author,
        });
      }
    }
  },
});
