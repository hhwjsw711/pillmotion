import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { aittsVoicesValidator, CREDIT_COSTS } from "./schema";
import OpenAI from "openai";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { consumeCreditsHelper } from "./credits";
import { ConvexError } from "convex/values";

export const updateStructuredText = mutation({
  args: {
    segmentId: v.id("segments"),
    structuredText: v.array(
      v.object({
        lineId: v.string(),
        type: v.union(v.literal("narration"), v.literal("dialogue")),
        characterName: v.optional(v.string()),
        text: v.string(),
        voice: v.optional(aittsVoicesValidator),
        voiceoverStorageId: v.optional(v.id("_storage")),
        isGeneratingVoiceover: v.optional(v.boolean()),
        voiceoverError: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { segmentId, structuredText }) => {
    await verifySegmentOwnerHelper(ctx, segmentId);
    await ctx.db.patch(segmentId, { structuredText });
  },
});

export const scheduleGenerateSingleLineVoiceover = mutation({
  args: {
    segmentId: v.id("segments"),
    lineId: v.string(),
  },
  handler: async (ctx, { segmentId, lineId }) => {
    const { segment, userId } = await verifySegmentOwnerHelper(ctx, segmentId);

    if (!segment.structuredText) {
      throw new ConvexError("Segment has no structured text.");
    }
    const lineIndex = segment.structuredText.findIndex(
      (l) => l.lineId === lineId,
    );
    if (lineIndex === -1) {
      throw new ConvexError("Line not found.");
    }

    const line = segment.structuredText[lineIndex];
    const lineText = line.text;
    const voice = line.voice ?? "alloy";

    if (!lineText.trim()) {
      throw new ConvexError("Cannot generate voiceover for empty text.");
    }

    await consumeCreditsHelper(ctx, userId, CREDIT_COSTS.CHAT_COMPLETION);

    const newStructuredText = [...segment.structuredText];
    newStructuredText[lineIndex] = {
      ...newStructuredText[lineIndex],
      isGeneratingVoiceover: true,
      voiceoverError: undefined,
    };
    await ctx.db.patch(segmentId, { structuredText: newStructuredText });

    await ctx.scheduler.runAfter(
      0,
      internal.segments.generateSingleLineVoiceover,
      {
        segmentId,
        lineId,
        lineText,
        voice,
      },
    );
  },
});

export const generateSingleLineVoiceover = internalAction({
  args: {
    segmentId: v.id("segments"),
    lineId: v.string(),
    lineText: v.string(),
    voice: aittsVoicesValidator,
  },
  handler: async (ctx, { segmentId, lineId, lineText, voice }) => {
    try {
      const speech = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice,
        input: lineText,
      });

      const buffer = await speech.arrayBuffer();
      const storageId = await ctx.storage.store(new Blob([buffer]));

      await ctx.runMutation(
        internal.segments.updateSingleLineVoiceoverSuccess,
        {
          segmentId,
          lineId,
          storageId,
        },
      );
    } catch (error: any) {
      console.error("Failed to generate voiceover:", error);
      await ctx.runMutation(internal.segments.updateSingleLineVoiceoverError, {
        segmentId,
        lineId,
        error: error.message || "Unknown error",
      });
    }
  },
});

export const updateSingleLineVoiceoverSuccess = internalMutation({
  args: {
    segmentId: v.id("segments"),
    lineId: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { segmentId, lineId, storageId }) => {
    const segment = await ctx.db.get(segmentId);
    if (!segment || !segment.structuredText) return;
    const lineIndex = segment.structuredText.findIndex(
      (l) => l.lineId === lineId,
    );
    if (lineIndex === -1) return;

    const newStructuredText = [...segment.structuredText];
    newStructuredText[lineIndex] = {
      ...newStructuredText[lineIndex],
      voiceoverStorageId: storageId,
      isGeneratingVoiceover: false,
      voiceoverError: undefined,
    };
    await ctx.db.patch(segmentId, { structuredText: newStructuredText });
  },
});

export const updateSingleLineVoiceoverError = internalMutation({
  args: {
    segmentId: v.id("segments"),
    lineId: v.string(),
    error: v.string(),
  },
  handler: async (ctx, { segmentId, lineId, error }) => {
    const segment = await ctx.db.get(segmentId);
    if (!segment || !segment.structuredText) return;
    const lineIndex = segment.structuredText.findIndex(
      (l) => l.lineId === lineId,
    );
    if (lineIndex === -1) return;

    const newStructuredText = [...segment.structuredText];
    newStructuredText[lineIndex] = {
      ...newStructuredText[lineIndex],
      isGeneratingVoiceover: false,
      voiceoverError: error,
      voiceoverStorageId: undefined,
    };
    await ctx.db.patch(segmentId, { structuredText: newStructuredText });
  },
});

export const deleteSingleLineVoiceover = mutation({
  args: {
    segmentId: v.id("segments"),
    lineId: v.string(),
  },
  handler: async (ctx, { segmentId, lineId }) => {
    await verifySegmentOwnerHelper(ctx, segmentId);

    const segment = await ctx.db.get(segmentId);
    if (!segment || !segment.structuredText) return;

    const line = segment.structuredText.find((l) => l.lineId === lineId);
    if (line?.voiceoverStorageId) {
      await ctx.storage.delete(line.voiceoverStorageId);
    }

    const newStructuredText = segment.structuredText.map((l) => {
      if (l.lineId === lineId) {
        return {
          ...l,
          voiceoverStorageId: undefined,
          voiceoverError: undefined,
          isGeneratingVoiceover: undefined,
        };
      }
      return l;
    });
    await ctx.db.patch(segmentId, { structuredText: newStructuredText });
  },
});

const openai = new OpenAI();

async function verifySegmentOwnerHelper(
  ctx: MutationCtx | QueryCtx,
  segmentId: Id<"segments">,
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("User not authenticated.");
  }
  const segment = await ctx.db.get(segmentId);
  if (!segment) {
    throw new ConvexError("Segment not found.");
  }
  const story = await ctx.db.get(segment.storyId);
  if (!story) {
    throw new ConvexError("Associated story not found.");
  }
  if (story.userId !== userId) {
    throw new ConvexError("User is not the owner of this segment.");
  }
  return { segment, story, userId };
}

function getSystemPrompt(context?: string) {
  const defaultStyle = "A vibrant, cinematic anime style.";
  const contextString =
    context || `{"style_bible": {"visual_theme": "${defaultStyle}"}}`;

  // Dynamically add keywords based on the style guide
  let dynamicKeywords = "";
  try {
    const parsedContext = JSON.parse(contextString);
    const theme = parsedContext?.style_bible?.visual_theme?.toLowerCase() || "";
    if (theme.includes("cinematic")) {
      dynamicKeywords +=
        ", cinematic lighting, epic composition, ultra-detailed, film grain, anamorphic lens flare";
    }
    if (theme.includes("anime") || theme.includes("animation")) {
      dynamicKeywords +=
        ", trending on pixiv, studio ghibli style, clean line art";
    }
    if (theme.includes("photo")) {
      dynamicKeywords += ", photorealistic, 8k, sharp focus, f/1.8";
    }
  } catch (e) {
    // Ignore parsing errors, just use the default
  }

  return `You are an expert prompt engineer for text-to-image models. Your mission is to generate a high-quality, detailed image prompt **IN ENGLISH**.

You will be given a "Style Bible" and a "Scene Description". Both might be in a language other than English. You must first understand their meaning and then synthesize them into a single, cohesive, and descriptive prompt for an image generation model.

**IMPORTANT RULES**:
1.  **Output Language**: The final output prompt inside the JSON object MUST be in **ENGLISH**.
2.  **Synthesize, Don't Just Translate**: Do not just literally translate the words. Understand the artistic direction from the Style Bible and the narrative moment from the Scene Description, and combine them into a powerful visual instruction.
3.  **Technical Details**: Incorporate advanced photographic and artistic terms. Start with the core description, then append stylistic keywords.
4.  **Adherence**: Strictly adhere to the visual and thematic elements described in the Style Bible.
5.  **Final Prompt Structure**: The final prompt should be a series of descriptive phrases, separated by commas. It should incorporate these dynamic keywords: "${dynamicKeywords}".
6.  **Output Format**: Respond with ONLY a single JSON object with one key: "prompt". The value of "prompt" should be the final, English-language image prompt.

**STYLE BIBLE (JSON)**:
${contextString}

**SCENE DESCRIPTION (Text)**:
The scene to illustrate will be provided in the user message.
`;
}

export const updateSegmentText = mutation({
  args: {
    segmentId: v.id("segments"),
    text: v.string(),
  },
  async handler(ctx, args) {
    await verifySegmentOwnerHelper(ctx, args.segmentId);
    await ctx.db.patch(args.segmentId, { text: args.text });
  },
});

export const regenerateImage = mutation({
  args: {
    segmentId: v.id("segments"),
    prompt: v.string(),
  },
  async handler(ctx, args) {
    const { userId } = await verifySegmentOwnerHelper(ctx, args.segmentId);
    await consumeCreditsHelper(ctx, userId, CREDIT_COSTS.IMAGE_GENERATION);

    await ctx.db.patch(args.segmentId, {
      isGenerating: true,
      error: undefined,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.replicate.regenerateSegmentImageUsingPrompt,
      {
        segmentId: args.segmentId,
        prompt: args.prompt,
      },
    );
  },
});

export const editImage = mutation({
  args: {
    segmentId: v.id("segments"),
    prompt: v.string(),
    versionIdToEdit: v.id("imageVersions"),
  },
  async handler(ctx, args) {
    const { userId } = await verifySegmentOwnerHelper(ctx, args.segmentId);

    const versionToEdit = await ctx.db.get(args.versionIdToEdit);
    if (!versionToEdit || versionToEdit.segmentId !== args.segmentId) {
      throw new Error("Version to edit is not valid for this segment.");
    }

    await consumeCreditsHelper(ctx, userId, CREDIT_COSTS.IMAGE_GENERATION);

    await ctx.db.patch(args.segmentId, {
      isGenerating: true,
      error: undefined,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.replicate.editSegmentImageUsingPrompt,
      {
        segmentId: args.segmentId,
        newInstruction: args.prompt,
        versionIdToEdit: args.versionIdToEdit,
        originalPrompt: versionToEdit.prompt,
      },
    );
  },
});

export const generateAndCreateSegment = internalAction({
  args: {
    userId: v.id("users"),
    storyId: v.id("story"),
    text: v.string(),
    order: v.number(),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    let segmentId: Id<"segments"> | null = null;
    try {
      segmentId = await ctx.runMutation(internal.segments.createSegment, {
        storyId: args.storyId,
        text: args.text,
        order: args.order,
      });

      await ctx.runMutation(internal.segments.updateSegmentStatus, {
        segmentId,
        isGenerating: true,
      });

      await ctx.runMutation(internal.credits.consumeCredits, {
        userId: args.userId,
        cost: CREDIT_COSTS.IMAGE_GENERATION,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: getSystemPrompt(args.context) },
          { role: "user", content: args.text },
        ],
        response_format: { type: "json_object" },
      });
      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error("OpenAI did not return content for prompt generation.");
      }
      const prompt = JSON.parse(content).prompt;

      await ctx.runAction(
        internal.replicate.regenerateSegmentImageUsingPrompt,
        {
          segmentId,
          prompt,
        },
      );

      return { success: true };
    } catch (error: any) {
      console.error("Failed to generate segment:", error);
      if (segmentId) {
        await ctx.runMutation(internal.segments.updateSegmentStatus, {
          segmentId,
          isGenerating: false,
          error: error.message || "Unknown error",
        });
      }
      return { success: false, error: error.message };
    }
  },
});

export const createSegment = internalMutation({
  args: {
    storyId: v.id("story"),
    text: v.string(),
    order: v.number(),
  },
  async handler(ctx, args) {
    return await ctx.db.insert("segments", {
      storyId: args.storyId,
      text: args.text,
      order: args.order,
      isGenerating: false,
    });
  },
});

export const get = query({
  args: { id: v.id("segments") },
  handler: async (ctx, args) => {
    const segment = await ctx.db.get(args.id);
    if (!segment) return null;

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      // Unauthenticated users cannot get any segment
      return null;
    }

    const story = await ctx.db.get(segment.storyId);
    if (!story || story.userId !== userId) {
      // User is not authorized to view this segment
      return null;
    }

    const selectedVersion = segment.selectedVersionId
      ? await ctx.db.get(segment.selectedVersionId)
      : null;

    return { ...segment, selectedVersion };
  },
});

export const deleteSegment = mutation({
  args: { segmentId: v.id("segments") },
  handler: async (ctx, { segmentId }) => {
    const { segment: segmentToDelete } = await verifySegmentOwnerHelper(
      ctx,
      segmentId,
    );

    const imageVersions = await ctx.db
      .query("imageVersions")
      .withIndex("by_segment", (q) => q.eq("segmentId", segmentId))
      .collect();

    for (const version of imageVersions) {
      if (version.image) await ctx.storage.delete(version.image);
      if (version.previewImage) await ctx.storage.delete(version.previewImage);
      await ctx.db.delete(version._id);
    }

    await ctx.db.delete(segmentId);

    const subsequentSegments = await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) =>
        q.eq("storyId", segmentToDelete.storyId),
      )
      .filter((q) => q.gt(q.field("order"), segmentToDelete.order))
      .order("asc")
      .collect();

    for (const segment of subsequentSegments) {
      await ctx.db.patch(segment._id, { order: segment.order - 1 });
    }
  },
});

export const reorderSegments = mutation({
  args: {
    storyId: v.id("story"),
    segmentIds: v.array(v.id("segments")),
  },
  handler: async (ctx, { storyId, segmentIds }) => {
    const identity = await getAuthUserId(ctx);
    if (!identity) throw new Error("User not authenticated");

    const story = await ctx.db.get(storyId);
    if (!story || story.userId !== identity) {
      throw new Error("User not authorized");
    }

    // To ensure atomicity and prevent race conditions,
    // we perform all database writes sequentially without any `await` inside the loop.
    const updatePromises = segmentIds.map((segmentId, index) =>
      ctx.db.patch(segmentId, { order: index }),
    );

    // We await all the promises at the end.
    // If any patch fails, Convex will automatically roll back the entire transaction.
    await Promise.all(updatePromises);
  },
});

export const addSegment = mutation({
  args: { storyId: v.id("story") },
  handler: async (ctx, { storyId }) => {
    const identity = await getAuthUserId(ctx);
    if (!identity) throw new Error("User not authenticated");

    const story = await ctx.db.get(storyId);
    if (!story || story.userId !== identity) {
      throw new Error("User not authorized");
    }

    // Find the current highest order
    const lastSegment = await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) => q.eq("storyId", storyId))
      .order("desc")
      .first();

    const newOrder = lastSegment ? lastSegment.order + 1 : 0;

    // Insert the new segment at the end
    const newSegmentId = await ctx.db.insert("segments", {
      storyId,
      order: newOrder,
      text: "新场景...",
      isGenerating: false,
    });

    return newSegmentId;
  },
});

export const getByStory = query({
  args: { storyId: v.id("story") },
  async handler(ctx, args) {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      // Return empty array for unauthenticated users, or throw error, depending on desired public visibility
      return [];
    }
    // Authorization check
    const story = await ctx.db.get(args.storyId);
    if (!story || story.userId !== userId) {
      // If the story doesn't exist or doesn't belong to the user, return empty.
      return [];
    }

    const segments = await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) => q.eq("storyId", args.storyId))
      .collect();

    const versionIds = segments
      .map((s) => s.selectedVersionId)
      .filter((id) => id !== undefined) as Id<"imageVersions">[];

    if (versionIds.length === 0) {
      return segments.map((s) => ({ ...s, selectedVersion: null }));
    }

    const versions = await ctx.db
      .query("imageVersions")
      .filter((q) => q.or(...versionIds.map((id) => q.eq(q.field("_id"), id))))
      .collect();

    const versionsById = new Map(versions.map((v) => [v._id, v]));

    return segments.map((segment) => ({
      ...segment,
      selectedVersion: segment.selectedVersionId
        ? (versionsById.get(segment.selectedVersionId) ?? null)
        : null,
    }));
  },
});

export const getSegmentInternal = internalQuery({
  args: { segmentId: v.id("segments") },
  async handler(ctx, args) {
    return await ctx.db.get(args.segmentId);
  },
});

export const updateSegmentStatus = internalMutation({
  args: {
    segmentId: v.id("segments"),
    isGenerating: v.optional(v.boolean()),
    error: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const { segmentId, ...rest } = args;
    await ctx.db.patch(segmentId, rest);
  },
});
