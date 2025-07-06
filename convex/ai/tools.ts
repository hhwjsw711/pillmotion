"use node";

import { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { tool } from "ai";
import { sendSystemMessageToConversation } from "./utils";
import Exa from "exa-js";
import { pick } from "convex-helpers";
import { Resend } from "resend";
import {
  toolDefinitions,
  AgentToolName,
  alwaysIncludedTools,
} from "../../shared/tools";

const exa = new Exa(process.env.EXA_API_KEY);
const resend = new Resend(process.env.AUTH_RESEND_KEY);

export const createTools = ({
  ctx,
  agent,
  conversation,
  agentParticipant,
}: {
  ctx: ActionCtx;
  agent: Doc<"agents">;
  agentParticipant: Doc<"conversationParticipants">;
  conversation: Doc<"conversations">;
}) => ({
  [toolDefinitions.listConversationParticipants.name]: tool({
    description: toolDefinitions.listConversationParticipants.description,
    parameters: toolDefinitions.listConversationParticipants.parameters,
    execute: async ({ conversationId }) => {
      await sendSystemMessageToConversation(ctx, {
        content: `${agent.name} is listing participants in the conversation ${conversation._id}`,
        conversationId: conversation._id,
        meta: {
          toolName: "listConversationParticipants",
          agentName: agent.name,
        },
      });
      const participants = await ctx.runQuery(
        internal.conversationParticipants.internalQueries
          .listNonSystemAgentParticipantsWithJoinedDetails,
        {
          conversationId: conversationId as Id<"conversations">,
        },
      );

      // Lets turn them into the mention format which I hope is more AI compatible
      return participants.map((p) => {
        if (p.agent)
          return {
            kind: "agent",
            ...pick(p.agent, [
              "_id",
              "name",
              "description",
              "personality",
              "tools",
            ]),
          };

        if (p.user)
          return {
            kind: "user",
            ...pick(p.user, ["_id", "name", "email"]),
          };

        return null;
      });
    },
  }),

  [toolDefinitions.listAgents.name]: tool({
    description: toolDefinitions.listAgents.description,
    parameters: toolDefinitions.listAgents.parameters,
    execute: async ({ userId }) => {
      console.log(`using tool: listAgents`, { userId });

      await sendSystemMessageToConversation(ctx, {
        content: `${agent.name} is listing the users agents ${conversation._id}`,
        conversationId: conversation._id,
        meta: { toolName: "listAgents", userId, agentName: agent.name },
      });

      return await ctx.runQuery(
        internal.agents.internalQueries.listAgentsForUser,
        {
          userId: userId as Id<"users">,
        },
      );
    },
  }),

  [toolDefinitions.messageAnotherAgent.name]: tool({
    description: toolDefinitions.messageAnotherAgent.description,
    parameters: toolDefinitions.messageAnotherAgent.parameters,
    execute: async ({ target, content }) => {
      return await ctx.runMutation(
        internal.conversationMessages.internalMutations.sendFromAgent,
        {
          conversationId: conversation._id,
          content: `@[${target.agentName}](agent:${target.agentId}) ${content}`,
          agentId: agent._id,
          authorParticipantId: agentParticipant._id,
        },
      );
    },
  }),

  [toolDefinitions.noOutput.name]: tool({
    description: toolDefinitions.noOutput.description,
    parameters: toolDefinitions.noOutput.parameters,
  }),

  [toolDefinitions.webSearch.name]: tool({
    description: toolDefinitions.webSearch.description,
    parameters: toolDefinitions.webSearch.parameters,
    execute: async ({ query }) => {
      await sendSystemMessageToConversation(ctx, {
        content: `${agent.name} is searching the web for "${query}"`,
        conversationId: conversation._id,
        meta: { toolName: "webSearch", query, agentName: agent.name },
      });
      const result = await exa.answer(query, { text: true });
      console.log(`webSearch result:`, result);
      return pick(result, ["answer", "citations"]);
    },
  }),

  [toolDefinitions.updateConversationTitle.name]: tool({
    description: toolDefinitions.updateConversationTitle.description,
    parameters: toolDefinitions.updateConversationTitle.parameters,
    execute: async ({ title }) => {
      await ctx.runMutation(internal.conversations.internalMutations.update, {
        conversationId: conversation._id,
        title,
      });

      await sendSystemMessageToConversation(ctx, {
        content: `${agent.name} updated the conversation title to "${title}"`,
        conversationId: conversation._id,
        meta: {
          toolName: "updateConversationTitle",
          newTitle: title,
          agentName: agent.name,
        },
      });

      return {
        result: "title_updated",
        newTitle: title,
      };
    },
  }),

  [toolDefinitions.scheduleTask.name]: tool({
    description: toolDefinitions.scheduleTask.description,
    parameters: toolDefinitions.scheduleTask.parameters,
    execute: async ({ content, secondsFromNow, target, title }) => {
      await sendSystemMessageToConversation(ctx, {
        content: `${agent.name} scheduled a task "${title}" to be sent in ${secondsFromNow} seconds`,
        conversationId: conversation._id,
        meta: {
          toolName: "scheduleTask",
          title,
          secondsFromNow,
          target,
          content,
          agentName: agent.name,
        },
      });

      const scheduledMessageId = await ctx.scheduler.runAfter(
        secondsFromNow * 1000,
        internal.conversationMessages.internalMutations.sendFromAgent,
        {
          conversationId: conversation._id,
          content: `@[${target.agentName}](agent:${target.agentId}) ${content}`,
          agentId: agent._id,
          authorParticipantId: agentParticipant._id,
        },
      );

      return {
        result: "message_sent",
        scheduledMessageId,
      };
    },
  }),

  [toolDefinitions.sendEmail.name]: tool({
    description: toolDefinitions.sendEmail.description,
    parameters: toolDefinitions.sendEmail.parameters,
    execute: async ({ to, subject, content, from }) => {
      await sendSystemMessageToConversation(ctx, {
        content: `${agent.name} is sending an email to "${to}" with the subject "${subject}"`,
        conversationId: conversation._id,
        meta: {
          toolName: "sendEmail",
          to,
          subject,
          content,
          from,
          agentName: agent.name,
        },
      });

      try {
        const response = await resend.emails.send({
          to,
          subject,
          html: content,
          from: "mike.cann@convex.dev",
        });

        if (response.error)
          throw new Error(`Failed to send email: ${response.error.message}`);

        return {
          result: "email_sent",
        };
      } catch (error: any) {
        console.error("Failed to send email:", error);
        throw new Error(
          `Failed to send email: ${error?.message ?? "Unknown error"}`,
        );
      }
    },
  }),

  [toolDefinitions.addParticipantToConversation.name]: tool({
    description: toolDefinitions.addParticipantToConversation.description,
    parameters: toolDefinitions.addParticipantToConversation.parameters,
    execute: async ({ agentId }) => {
      try {
        await sendSystemMessageToConversation(ctx, {
          content: `${agent.name} is adding an agent with ID ${agentId} to the conversation`,
          conversationId: conversation._id,
          meta: {
            toolName: "addParticipantToConversation",
            agentId,
            agentName: agent.name,
          },
        });

        const participant = await ctx.runMutation(
          internal.conversationParticipants.internalMutations
            .addAgentIfNotAlreadyJoined,
          {
            conversationId: conversation._id,
            agentId: agentId as Id<"agents">,
          },
        );

        return {
          result: "participant_added",
          participantId: participant,
          type: "agent",
        };
      } catch (error: any) {
        console.error("Failed to add agent:", error);
        throw new Error(
          `Failed to add agent: ${error?.message ?? "Unknown error"}`,
        );
      }
    },
  }),
});

export const createToolsForAgent = ({
  ctx,
  agent,
  conversation,
  agentParticipant,
}: {
  ctx: ActionCtx;
  agent: Doc<"agents">;
  agentParticipant: Doc<"conversationParticipants">;
  conversation: Doc<"conversations">;
}) => {
  const allTools = createTools({ ctx, agent, conversation, agentParticipant });
  return pick(allTools, [
    ...(Object.keys(alwaysIncludedTools) as AgentToolName[]),
    ...(agent.tools as AgentToolName[]),
  ]);
};
