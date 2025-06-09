import { query, mutation, internalQuery } from "./_generated/server";
import { StreamId } from "@convex-dev/persistent-text-streaming";
import { ConvexError, v } from "convex/values";
import { streamingComponent } from "./streaming";
import { auth } from "./auth";

export const listMessages = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }
    return await ctx.db
      .query("userMessages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const clearMessages = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return;
    }
    const chats = await ctx.db
      .query("userMessages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(chats.map((chat) => ctx.db.delete(chat._id)));
  },
});

export const sendMessage = mutation({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new ConvexError("User must be authenticated to send a message.");
    }
    const responseStreamId = await streamingComponent.createStream(ctx);
    const chatId = await ctx.db.insert("userMessages", {
      userId,
      prompt: args.prompt,
      responseStreamId,
    });
    return chatId;
  },
});

export const getHistory = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Grab all the user messages
    const allMessages = await ctx.db
      .query("userMessages")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Lets join the user messages with the assistant messages
    const joinedResponses = await Promise.all(
      allMessages.map(async (userMessage) => {
        return {
          userMessage,
          responseMessage: await streamingComponent.getStreamBody(
            ctx,
            userMessage.responseStreamId as StreamId,
          ),
        };
      }),
    );

    return joinedResponses.flatMap((joined) => {
      const user = {
        role: "user" as const,
        content: joined.userMessage.prompt,
      };

      const assistant = {
        role: "assistant" as const,
        content: joined.responseMessage.text,
      };

      // If the assistant message is empty, its probably because we have not
      // started streaming yet so lets not include it in the history
      if (!assistant.content) return [user];

      return [user, assistant];
    });
  },
});
