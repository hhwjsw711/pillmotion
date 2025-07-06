import { CoreMessage } from "ai";
import { ActionCtx } from "../_generated/server";
import { getMessageHistory } from "./history";
import { Doc } from "../_generated/dataModel";
import { ParticipantUserOrAgent } from "../conversationParticipants/model";
import { createMentionString } from "../../shared/mentions";

export const gatherMessages = async (
  ctx: ActionCtx,
  {
    systemMessage,
    conversation,
    message,
    messageAuthor,
  }: {
    systemMessage: string;
    conversation: Doc<"conversations">;
    message: Doc<"conversationMessages">;
    messageAuthor: ParticipantUserOrAgent;
  },
): Promise<CoreMessage[]> => {
  const messageHistory = await getMessageHistory(ctx, {
    conversationId: conversation._id,
    messageId: message._id,
    count: 30,
  });

  const messages: CoreMessage[] = [
    {
      role: "system",
      content: systemMessage,
    },
    ...messageHistory.map((m) => ({
      role: "user" as const,
      content: `${createMentionString(
        m.author.kind === "user"
          ? {
              kind: "user" as const,
              userId: m.author._id,
              name: m.author.name ?? "Unknown User",
            }
          : {
              kind: "agent" as const,
              agentId: m.author._id,
              name: m.author.name,
            },
      )} said: ${m.message.content}`,
    })),
    {
      role: "user" as const,
      content: `${createMentionString(
        messageAuthor.kind === "user"
          ? {
              kind: "user" as const,
              userId: messageAuthor.user._id,
              name: messageAuthor.user.name ?? "Unknown User",
            }
          : {
              kind: "agent" as const,
              agentId: messageAuthor.agent._id,
              name: messageAuthor.agent.name,
            },
      )} said: ${message.content}`,
    },
  ];

  console.log(`agent messages:`, messages);

  return messages;
};
