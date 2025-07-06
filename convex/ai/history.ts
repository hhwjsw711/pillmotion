import { internal } from "../_generated/api";
import { isNotNullOrUndefined } from "../../shared/filter";
import { Id } from "../_generated/dataModel";
import { ActionCtx } from "../_generated/server";

export const getMessageHistory = async (
  ctx: ActionCtx,
  args: {
    conversationId: Id<"conversations">;
    messageId: Id<"conversationMessages">;
    count: number;
  },
) => {
  return await ctx
    .runQuery(
      internal.conversationMessages.internalQueries
        .listMessagesHistoryForAgentGeneration,
      { conversationId: args.conversationId, count: args.count },
    )
    .then((messages) =>
      messages
        .filter((m) => (m.message._id == args.messageId ? null : m)) // exclude the message we are looking at
        .filter(isNotNullOrUndefined),
    );
};
