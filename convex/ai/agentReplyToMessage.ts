"use node";

import { Doc } from "../_generated/dataModel";
import { openai } from "@ai-sdk/openai";
import { Id } from "../_generated/dataModel";
import { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { createToolsForAgent } from "./tools";
import { generateText } from "ai";
import { constructAgentReplyInstructions } from "./instructions";
import { ParticipantUserOrAgent } from "../conversationParticipants/model";
import { gatherMessages } from "./messages";
import {
  getAgentAndEnsureItIsJoinedToConversation,
  runAgentAIGeneration,
  processAgentAIResult,
} from "./utils";

export const agentReplyToMessage = async (
  ctx: ActionCtx,
  args: {
    message: Doc<"conversationMessages">;
    agentId: Id<"agents">;
    conversation: Doc<"conversations">;
    messageAuthor: ParticipantUserOrAgent;
  },
) => {
  const { agent, participant } =
    await getAgentAndEnsureItIsJoinedToConversation(ctx, {
      agentId: args.agentId,
      conversationId: args.message.conversationId,
    });

  if (participant.kind !== "agent")
    throw new Error(
      `Participant of id '${participant._id}' is not an agent, but is of kind '${participant.kind}'`,
    );

  await runAgentAIGeneration(ctx, {
    agent,
    participant,
    conversation: args.conversation,
    generateAIResponse: async () => {
      const result = await generateText({
        model: openai("gpt-4o"),
        tools: createToolsForAgent({
          ctx,
          agent,
          agentParticipant: participant,
          conversation: args.conversation,
        }),
        maxSteps: 10,
        messages: await gatherMessages(ctx, {
          systemMessage: constructAgentReplyInstructions({
            conversation: args.conversation,
            messageAuthor: args.messageAuthor,
            agent,
          }),
          conversation: args.conversation,
          message: args.message,
          messageAuthor: args.messageAuthor,
        }),
      });

      await processAgentAIResult(ctx, {
        result,
        agent,
        conversation: args.conversation,
        participant,
        sendMessage: async (text) => {
          await ctx.runMutation(
            internal.conversationMessages.internalMutations.sendFromAgent,
            {
              conversationId: args.message.conversationId,
              agentId: agent._id,
              content: text,
              authorParticipantId: participant._id,
            },
          );
        },
      });

      return result;
    },
  });
};
