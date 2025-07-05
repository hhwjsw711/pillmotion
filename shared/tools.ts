import { z } from "zod";
import { pick } from "convex-helpers";

export const toolDefinitions = {
  listConversationParticipants: {
    name: "listConversationParticipants",
    description: "A tool for listing the participants in a conversation.",
    parameters: z.object({
      conversationId: z
        .string()
        .describe("The ID of the conversation to list participants for"),
    }),
  },
  listAgents: {
    name: "listAgents",
    description: "Allows listing of all of a user's agents",
    parameters: z.object({
      userId: z.string().describe("The ID of the user whose agents to list"),
    }),
  },
  messageAnotherAgent: {
    name: "messageAnotherAgent",
    description: "Allows sending of a message to another agent",
    parameters: z.object({
      target: z
        .object({
          agentId: z.string(),
          agentName: z.string(),
        })
        .describe("The target agent to message"),
      content: z.string().describe("The message content to send"),
    }),
  },
  noOutput: {
    name: "noOutput",
    description: "Use this tool if you dont want to return any output",
    parameters: z.object({
      reasoning: z.string().describe("The reason for not returning output"),
    }),
  },
  webSearch: {
    name: "webSearch",
    description: "Use this tool to search the web for information",
    parameters: z.object({
      query: z.string().describe("The search query to execute"),
    }),
  },
  scheduleTask: {
    name: "scheduleTask",
    description: "Allows scheduling of a task to be completed at a later time.",
    parameters: z.object({
      target: z
        .object({
          agentId: z.string(),
          agentName: z.string(),
        })
        .describe("The target agent for the scheduled task"),
      title: z.string().describe("The title of the scheduled task"),
      content: z.string().describe("The content of the scheduled task"),
      secondsFromNow: z
        .number()
        .describe("When to schedule the task for (in seconds from now)"),
    }),
  },
  updateConversationTitle: {
    name: "updateConversationTitle",
    description:
      "Updates the title of the current conversation to better reflect its content",
    parameters: z.object({
      title: z.string().describe("The new title for the conversation"),
    }),
  },
  sendEmail: {
    name: "sendEmail",
    description: "Sends an email using Resend",
    parameters: z.object({
      to: z.string().describe("The email address to send to"),
      subject: z.string().describe("The subject of the email"),
      content: z.string().describe("The HTML content of the email"),
      from: z
        .string()
        .optional()
        .describe("Optional from address, defaults to the system default"),
    }),
  },
  addParticipantToConversation: {
    name: "addParticipantToConversation",
    description: "Adds an agent to the current conversation",
    parameters: z.object({
      agentId: z
        .string()
        .describe("The ID of the agent to add to the conversation"),
    }),
  },
} as const;

export type AgentToolName = keyof typeof toolDefinitions;

// Define the subset of tools that users can choose from
export const userChoosableToolDefinitions = pick(toolDefinitions, [
  "webSearch",
  "scheduleTask",
  "sendEmail",
]);

export type UserChoosableToolName = keyof typeof userChoosableToolDefinitions;

export const alwaysIncludedTools = pick(toolDefinitions, [
  "listConversationParticipants",
  "listAgents",
  "messageAnotherAgent",
  "noOutput",
  "updateConversationTitle",
  "addParticipantToConversation",
]);

export type AlwaysIncludedToolName = keyof typeof alwaysIncludedTools;
