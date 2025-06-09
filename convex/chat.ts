import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { StreamId } from "@convex-dev/persistent-text-streaming";
import { OpenAI } from "openai";
import { streamingComponent } from "./streaming";
import { Id } from "./_generated/dataModel";

const openai = new OpenAI();

export const streamChat = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = identity.subject.split("|")[0] as Id<"users">;

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
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional writer tasked with creating a short story for a voice over based on a given description. The story should be a story that is 10,000 characters max length. DO NOT TITLE ANY SEGMENT. JUST RETURN THE TEXT OF THE ENTIRE STORY. THIS IS FOR A VOICE OVER, ONLY INCLUDE THE SPOKEN WORDS.
          Please provide your response in markdown format.
          
          You are continuing a conversation. The conversation so far is found in the following JSON-formatted value:`,
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
