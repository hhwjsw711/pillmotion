import {
  mutation,
  query,
  internalAction,
  internalMutation,
  MutationCtx,
  QueryCtx,
  internalQuery,
} from "./_generated/server";
import { prosemirrorSync } from "./prosemirror";
import { auth } from "./auth";
import { ConvexError, v } from "convex/values";
import {
  storyFormatValidator,
  storyStatusValidator,
  CREDIT_COSTS,
  storyGenerationStatusValidator,
} from "./schema";
import { internal } from "./_generated/api";
import { consumeCreditsHelper } from "./credits";
import OpenAI from "openai";
import { Id } from "./_generated/dataModel";
import { nanoid } from "nanoid";

const openai = new OpenAI();

async function verifyStoryOwnerHelper(
  ctx: MutationCtx | QueryCtx,
  storyId: Id<"story">,
) {
  const userId = await auth.getUserId(ctx);
  if (!userId) {
    throw new ConvexError("User not authenticated.");
  }
  const story = await ctx.db.get(storyId);
  if (!story) {
    throw new ConvexError("Story not found.");
  }
  if (story.userId !== userId) {
    throw new ConvexError("User is not the owner of this story.");
  }
  return { story, userId };
}

export const list = query({
  args: {
    status: v.optional(storyStatusValidator),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }
    const query = args.status
      ? ctx.db
          .query("story")
          .withIndex("by_user_status", (q) =>
            q.eq("userId", userId).eq("status", args.status),
          )
      : ctx.db
          .query("story")
          .withIndex("userId", (q) => q.eq("userId", userId));

    return query.order("desc").collect();
  },
});

export const createStory = mutation({
  args: {
    title: v.optional(v.string()),
    script: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized operation");
    }

    const storyId = await ctx.db.insert("story", {
      updatedAt: Date.now(),
      userId,
      title: args.title ?? "新故事",
      script: args.script ?? "",
      status: "draft",
      generationStatus: "idle",
    });

    return storyId;
  },
});

export const initializeEditor = mutation({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    await verifyStoryOwnerHelper(ctx, args.storyId);
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");

    const scriptText = story.script || "";
    const paragraphs = scriptText
      .split("\n")
      .filter((p) => p.trim() !== "")
      .map((pText) => ({
        type: "paragraph",
        content: [{ type: "text", text: pText }],
      }));

    const initialContent =
      paragraphs.length > 0 ? paragraphs : [{ type: "paragraph", content: [] }];

    await prosemirrorSync.create(ctx, args.storyId, {
      type: "doc",
      content: initialContent,
    });
  },
});

export const updateStoryFormat = mutation({
  args: {
    storyId: v.id("story"),
    format: storyFormatValidator,
  },
  handler: async (ctx, args) => {
    await verifyStoryOwnerHelper(ctx, args.storyId);
    await ctx.db.patch(args.storyId, { format: args.format });
  },
});

export const getStory = query({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    const { story } = await verifyStoryOwnerHelper(ctx, args.storyId);
    return story;
  },
});

export const updateStoryTitle = mutation({
  args: {
    storyId: v.id("story"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyStoryOwnerHelper(ctx, args.storyId);
    await ctx.db.patch(args.storyId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

export const deleteStory = mutation({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    await verifyStoryOwnerHelper(ctx, args.storyId);
    await ctx.db.delete(args.storyId);
  },
});

export const generateSegments = mutation({
  args: {
    storyId: v.id("story"),
    format: storyFormatValidator,
  },
  handler: async (ctx, args) => {
    const { storyId, format } = args;
    const { userId } = await verifyStoryOwnerHelper(ctx, storyId);

    const generationId = nanoid();

    await ctx.db.patch(storyId, {
      format,
      generationStatus: "processing",
      generationId: generationId,
    });
    await consumeCreditsHelper(ctx, userId, CREDIT_COSTS.CHAT_COMPLETION);

    await ctx.scheduler.runAfter(0, internal.story.generateStoryOrchestrator, {
      storyId,
      userId: userId,
      generationId: generationId,
    });
  },
});

async function splitScriptIntoScenes(script: string): Promise<string[]> {
  try {
    const completion = await openai.chat.completions.create({
      // You can use "gpt-4o" for potentially higher accuracy, or "gpt-4o-mini" for a balance of speed and cost.
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert film editor and script supervisor. Your task is to read a story script and break it down into a sequence of distinct scenes or 'shots'.

A scene change typically occurs when:
- The location or setting changes (e.g., from a castle to a forest).
- There is a significant jump in time (e.g., "The next day...", "Hours later...").
- A new key character enters, or a key character begins a distinct action or dialogue.
- The emotional tone or focus of the narrative shifts significantly.

Each resulting scene should be a self-contained, visually coherent moment that can be reasonably illustrated by a single image. Preserve the original wording and language of the text.

Output the result as a single JSON object with a single key "scenes", which contains an array of strings. Do not output anything else.

Example Input:
"A princess lived in a castle. One day, she ran into the dark forest. 'Where am I?' she wondered. She found a small cottage."

Example Output:
{
  "scenes": [
    "A princess lived in a castle.",
    "One day, she ran into the dark forest.",
    "'Where am I?' she wondered.",
    "She found a small cottage."
  ]
}`,
        },
        { role: "user", content: script },
      ],
      // This is crucial for ensuring the AI returns valid JSON.
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;

    // Handle cases where the AI might not respond.
    if (!content) {
      console.error("AI did not return content for script splitting.");
      return [script]; // Fallback to the original script
    }

    // Parse the JSON response from the AI.
    const result = JSON.parse(content);

    // Check if the parsed object has the 'scenes' key and it's an array.
    if (result.scenes && Array.isArray(result.scenes)) {
      // Filter out any empty strings that might have been generated.
      return result.scenes.filter(
        (scene: unknown) => typeof scene === "string" && scene.trim() !== "",
      );
    }

    console.error("AI response did not match the expected format:", result);
    return [script]; // Fallback if the format is incorrect.
  } catch (error) {
    console.error("Failed to split script using AI:", error);
    // If any error occurs (network, parsing, etc.), we fall back to the safest option.
    return [script];
  }
}

export const generateStoryOrchestrator = internalAction({
  args: {
    storyId: v.id("story"),
    userId: v.id("users"),
    generationId: v.string(),
  },
  handler: async (ctx, args) => {
    const { storyId, userId, generationId } = args;
    const story = await ctx.runQuery(internal.story.getStoryInternal, {
      storyId,
    });
    if (!story) throw new Error("Story not found");

    let segments: string[];
    // If the script from the DB contains our special separator, it means the user has made paragraphs.
    if (story.script.includes("\n\n")) {
      // We use the structure the user provided.
      segments = story.script.split(/\n{2,}/).filter((s) => s.trim() !== "");
    } else {
      // Otherwise, the user provided a single block of text. Time for the AI Editor.
      segments = await splitScriptIntoScenes(story.script);
    }

    if (segments.length === 0) {
      await ctx.runMutation(internal.story.updateStoryGenerationStatus, {
        storyId,
        status: "completed",
      });
      return;
    }

    const context = await generateContext(story.script);
    await ctx.runMutation(internal.story.updateStoryContextInternal, {
      storyId,
      context,
    });

    const segmentGenerationPromises = segments.map((text, order) =>
      ctx.runAction(internal.segments.generateAndCreateSegment, {
        storyId,
        text,
        order,
        context,
        userId,
      }),
    );

    const results = await Promise.all(segmentGenerationPromises);

    const currentStory = await ctx.runQuery(internal.story.getStoryInternal, {
      storyId,
    });

    if (currentStory?.generationId !== generationId) {
      // A new generation task has been started. This task is now obsolete.
      // We should silently exit and not update the status.
      console.log(
        `Orchestrator (genId: ${generationId}) is obsolete. Current is ${currentStory?.generationId}. Aborting final status update.`,
      );
      return;
    }

    const hasErrors = results.some((r) => !r.success);
    const finalStatus = hasErrors ? "error" : "completed";

    await ctx.runMutation(internal.story.updateStoryGenerationStatus, {
      storyId,
      status: finalStatus,
    });
  },
});

export const updateStoryContextInternal = internalMutation({
  args: {
    storyId: v.id("story"),
    context: v.string(),
  },
  handler: async (ctx, args) => {
    // No auth check needed here, as it's only called by trusted server code.
    await ctx.db.patch(args.storyId, { context: args.context });
  },
});

export const updateStoryContext = mutation({
  args: {
    storyId: v.id("story"),
    context: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyStoryOwnerHelper(ctx, args.storyId);
    await ctx.db.patch(args.storyId, { context: args.context });
  },
});

export const updateStoryGenerationStatus = internalMutation({
  args: {
    storyId: v.id("story"),
    status: storyGenerationStatusValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.storyId, { generationStatus: args.status });
  },
});

async function generateContext(script: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a top-tier showrunner for a film studio. Your task is to analyze the provided script and generate a comprehensive "Production Bible" in a single JSON object. This bible will guide all visual and narrative production.

The JSON object MUST contain exactly two top-level keys:
1.  "story_outline": A concise, one-paragraph summary of the entire plot, including the beginning, key turning points, and the ending.
2.  "style_bible": An object containing the visual style guide, which must include these keys: "visual_theme", "mood", "color_palette" (as a single comma-separated string, e.g., "bright blues, sunny yellows, coral pinks"), "lighting_style", "character_design", "environment_design".

**IMPORTANT**: First, detect the primary language of the input script. The entire "story_outline" and all values within the "style_bible" MUST be written in this detected language. This ensures consistency for our international teams.

Do not output anything besides this single, complete JSON object. If the script is too short, nonsensical, or you cannot perform the task, return a JSON object with a single key "error" containing a brief explanation.`,
      },
      {
        role: "user",
        content: script,
      },
    ],
    max_tokens: 800,
    response_format: { type: "json_object" },
  });
  const context = completion.choices[0].message.content;
  if (!context) throw new Error("Failed to generate context from OpenAI.");
  return context;
}

export const getStoryInternal = internalQuery({
  args: { storyId: v.id("story") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.storyId);
  },
});
