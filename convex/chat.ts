import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { StreamId } from "@convex-dev/persistent-text-streaming";
import { OpenAI } from "openai";
import { streamingComponent } from "./streaming";

const openai = new OpenAI();

export const streamChat = httpAction(async (ctx, request) => {
  const body = (await request.json()) as {
    streamId: string;
  };

  // Start streaming and persisting at the same time while
  // we immediately return a streaming response to the client
  const response = await streamingComponent.stream(
    ctx,
    request,
    body.streamId as StreamId,
    async (ctx, _request, _streamId, append) => {
      // Lets grab the history up to now so that the AI has some context
      const history = await ctx.runQuery(internal.messages.getHistory);

      // Lets kickoff a stream request to OpenAI
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a master storyteller and professional scriptwriter, specializing in crafting vivid, immersive narratives for voice-overs. Your task is to create a story that feels alive when read aloud, using rich descriptions and a natural, conversational flow.

**Follow these rules strictly:**
- Your output must be plain text, perfectly suited for a text-to-speech (TTS) engine.
- Output ONLY the spoken words of the story. Do NOT include any titles, headings, scene descriptions, or character tags (like "Narrator:").
- Ensure the total length of your response does not exceed 10,000 characters.
- Use the provided conversation history to understand the user's intent and continue the story logically.`,
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
