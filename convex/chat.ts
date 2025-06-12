import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { StreamId } from "@convex-dev/persistent-text-streaming";
import { OpenAI } from "openai";
import { streamingComponent } from "./streaming";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

const openai = new OpenAI();

export const streamChat = httpAction(async (ctx, request) => {
  const userId = (await getAuthUserId(ctx)) as Id<"users">;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  let streamId: StreamId;
  try {
    const body = (await request.json()) as { streamId: string };
    streamId = body.streamId as StreamId;
  } catch (error) {
    // This can happen if the client polls the stream endpoint for a completed stream.
    // We can just return an empty response, and the client will get the
    // data from the query fallback.
    return new Response(null, { status: 204 }); // No Content for malformed requests
  }

  // Check if the stream is already completed by calling our public query.
  const streamBody = await ctx.runQuery(api.streaming.getStreamBody, {
    streamId: streamId as string,
  });
  if (streamBody?.status === "done") {
    // The stream is already complete, so there's nothing to do.
    // We return a 205 to let the client know it should not retry.
    return new Response(null, { status: 205 }); // Reset Content
  }

  // Start streaming and persisting at the same time while
  // we immediately return a streaming response to the client
  const response = await streamingComponent.stream(
    ctx,
    request,
    streamId,
    async (ctx, request, streamId, append) => {
      // Lets grab the history up to now so that the AI has some context
      const history = await ctx.runQuery(internal.messages.getHistory, {
        userId,
      });

      // Lets kickoff a stream request to OpenAI
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional scriptwriter tasked with creating a story for a voice-over.
- Your output must be plain text, suitable for a text-to-speech engine.
- Only include the spoken words. Do not add any titles, headings, scene descriptions, or character names like "Narrator:".
- The total length should not exceed 10,000 characters.
- You are continuing a conversation. Use the provided history to understand the user's intent and continue the story logically.`,
          },
          ...history,
        ],
        stream: true,
      });

      // Append each chunk to the persistent stream as they come in from openai
      for await (const part of stream)
        await append(part.choices[0]?.delta?.content || "");
    },
  );

  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Vary", "Origin");

  return response;
});
