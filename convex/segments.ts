import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  CREDIT_COSTS,
  videoClipGenerationStatusValidator,
  videoClipContextValidator, // UPDATED: Using the correct validator from your schema
} from "./schema";
import OpenAI from "openai";
import { Id } from "./_generated/dataModel";
import { consumeCreditsHelper } from "./credits";
import { verifySegmentOwner, verifyStoryOwner } from "./lib/auth";
import { ConvexError } from "convex/values";

const openai = new OpenAI();

// =================================================================
// >> Section 1: Core Segment & Editor Data Queries
// =================================================================

/**
 * [REFACTORED] A clean and efficient query to get all the data needed for the segment editor page.
 * It replaces the previous, complex `getSegmentEditorData` query.
 * The frontend will now receive two clean lists (images and videos) and can easily
 * perform the grouping logic, which is more flexible and robust.
 */
export const getSegmentEditorData = query({
  args: { segmentId: v.id("segments") },
  handler: async (ctx, args) => {
    // [FIX] Gracefully handle cases where the segment is deleted but a query for it is still active.
    try {
      // Authorize and get the segment in one go.
      const { segment } = await verifySegmentOwner(ctx, args.segmentId);

      // Fetch all image and video versions for this segment in parallel.
      const [imageVersions, videoClipVersions] = await Promise.all([
        // Fetch all image versions with their URLs pre-signed.
        ctx.db
          .query("imageVersions")
          .withIndex("by_segment", (q) => q.eq("segmentId", args.segmentId))
          .order("desc")
          .collect()
          .then((versions) =>
            Promise.all(
              versions.map(async (version) => ({
                ...version,
                previewImageUrl: version.previewImage
                  ? await ctx.storage.getUrl(version.previewImage)
                  : null,
              })),
            ),
          ),
        // Fetch all video versions with their URLs pre-signed.
        ctx.db
          .query("videoClipVersions")
          .withIndex("by_segment", (q) => q.eq("segmentId", args.segmentId))
          .order("desc")
          .collect()
          .then((versions) =>
            Promise.all(
              versions.map(async (version) => {
                // [NEW] Fetch video URL and poster URL in parallel for efficiency
                const [videoUrl, posterUrl, lastFramePosterUrl] =
                  await Promise.all([
                    version.storageId
                      ? ctx.storage.getUrl(version.storageId)
                      : null,
                    version.posterStorageId
                      ? ctx.storage.getUrl(version.posterStorageId)
                      : null,
                    version.lastFramePosterStorageId
                      ? ctx.storage.getUrl(version.lastFramePosterStorageId)
                      : null,
                  ]);
                return {
                  ...version,
                  videoUrl,
                  posterUrl,
                  lastFramePosterUrl,
                };
              }),
            ),
          ),
      ]);

      // This clean data structure is much simpler for the backend to provide
      // and easier for the frontend to consume.
      return {
        segment,
        imageVersions,
        videoClipVersions,
      };
    } catch (error) {
      // If the error is due to the segment/story not being found (e.g., it was deleted),
      // we can safely return null. For other errors (like auth), we should re-throw.
      if (
        error instanceof ConvexError &&
        (error.message.includes("Segment not found") ||
          error.message.includes("Story not found"))
      ) {
        return null;
      }
      throw error;
    }
  },
});

// =================================================================
// >> Section 2: Video Clip Operations (NEW & REFACTORED)
//    (This section contains all the critical schema-aligned logic)
// =================================================================

/**
 * [NEW & CRITICAL] The single, authoritative internal mutation for creating
 * a video clip version record. It accepts the new `context` object,
 * ensuring all data creation is schema-compliant. This is the heart of the refactor.
 */
export const createVideoClipVersion = internalMutation({
  args: {
    segmentId: v.id("segments"),
    userId: v.id("users"),
    context: videoClipContextValidator,
    // This is passed when generating a full story video
    generationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = args;
    const videoClipVersionId = await ctx.db.insert("videoClipVersions", {
      ...args,
      userIdString: userId, // Automatically add the string version of the userId for vector search filtering
      generationStatus: "generating",
      processingStatus: "idle",
    });
    return videoClipVersionId;
  },
});

/**
 * [NEW] User-facing mutation to kick off a "text-to-video" generation.
 * This provides a clean, single-purpose entry point for the feature.
 */
export const generateTextToVideo = mutation({
  args: { segmentId: v.id("segments"), prompt: v.string() },
  handler: async (ctx, { segmentId, prompt }) => {
    const { userId } = await verifySegmentOwner(ctx, segmentId);
    await consumeCreditsHelper(ctx, userId, CREDIT_COSTS.VIDEO_CLIP_GENERATION);

    // Provide immediate UI feedback by setting the generating state.
    await ctx.db.patch(segmentId, { isGenerating: true, error: undefined });

    // Schedule the backend action to do the heavy lifting.
    await ctx.scheduler.runAfter(
      0,
      internal.replicate.generateTextToVideoClip,
      {
        segmentId,
        userId,
        prompt,
      },
    );
  },
});

/**
 * [NEW] User-facing mutation to kick off an "image-to-video" generation.
 */
export const generateImageToVideo = mutation({
  args: {
    segmentId: v.id("segments"),
    imageVersionId: v.id("imageVersions"),
  },
  handler: async (ctx, { segmentId, imageVersionId }) => {
    const { userId } = await verifySegmentOwner(ctx, segmentId);
    await consumeCreditsHelper(ctx, userId, CREDIT_COSTS.VIDEO_CLIP_GENERATION);

    // Provide immediate UI feedback.
    await ctx.db.patch(segmentId, { isGenerating: true, error: undefined });

    // Schedule the backend action.
    await ctx.scheduler.runAfter(
      0,
      internal.replicate.generateImageToVideoClip,
      {
        segmentId,
        userId,
        imageVersionId,
      },
    );
  },
});

/**
 * [FIXED & REFACTORED] Correctly handles selecting a video clip.
 * If the clip is from another segment (i.e., from the media library), it now
 * correctly CLONES the record instead of just linking it, ensuring data integrity.
 */
export const selectVideoClipVersion = mutation({
  args: {
    segmentId: v.id("segments"),
    videoClipVersionId: v.id("videoClipVersions"),
  },
  handler: async (ctx, { segmentId, videoClipVersionId }) => {
    const { userId } = await verifySegmentOwner(ctx, segmentId);

    const originalVersion = await ctx.db.get(videoClipVersionId);
    if (!originalVersion) {
      throw new Error("Original video clip version not found");
    }

    // [SECURITY FIX] Ensure the user owns the original clip they are trying to use.
    if (originalVersion.userId !== userId) {
      throw new Error("You do not have permission to use this video clip.");
    }

    let versionToSelectId = videoClipVersionId;

    // If the selected version belongs to another segment, we must clone it.
    if (originalVersion.segmentId !== segmentId) {
      // Create a clean, new record for the clone.
      const newVersionId = await ctx.db.insert("videoClipVersions", {
        // Carry over essential, immutable data
        userId: originalVersion.userId,
        userIdString: originalVersion.userIdString,
        context: originalVersion.context, // The "blueprint" of the video
        storageId: originalVersion.storageId,
        // [FIX] Also clone the poster frame ID to ensure it's visible in the UI
        posterStorageId: originalVersion.posterStorageId,
        embedding: originalVersion.embedding,
        // Set new segment-specific data for the clone
        segmentId: segmentId, // Link to the current segment
        generationStatus: "generated", // It's already generated
        processingStatus: "idle",
      });
      versionToSelectId = newVersionId;
    }

    // [FIX] Atomically update the segment to point to the correct video version,
    // CLEAR the selected image version, and clear any loading/error states.
    await ctx.db.patch(segmentId, {
      selectedVideoClipVersionId: versionToSelectId,
      selectedVersionId: undefined, // [CORRECTION] Use undefined instead of null
      isGenerating: false,
      error: undefined,
    });

    // [CONSISTENCY] Also trigger a story thumbnail update.
    const segment = await ctx.db.get(segmentId);
    if (segment) {
      await ctx.scheduler.runAfter(
        0,
        internal.story.internalUpdateStoryThumbnail,
        {
          storyId: segment.storyId,
        },
      );
    }
  },
});

/**
 * [NEW] User-facing mutation to select an image version for a segment.
 * This mirrors the logic of `selectVideoClipVersion`, including cloning
 * the image if it's selected from the media library (i.e., belongs to another segment).
 */
export const selectImageVersion = mutation({
  args: {
    segmentId: v.id("segments"),
    versionId: v.id("imageVersions"),
  },
  handler: async (ctx, { segmentId, versionId }) => {
    const { userId } = await verifySegmentOwner(ctx, segmentId);

    const originalVersion = await ctx.db.get(versionId);
    if (!originalVersion) {
      throw new Error("Original image version not found");
    }

    if (originalVersion.userId !== userId) {
      throw new Error("You do not have permission to use this image.");
    }

    let versionToSelectId = versionId;

    if (originalVersion.segmentId !== segmentId) {
      const newVersionId = await ctx.db.insert("imageVersions", {
        // Carry over essential, immutable data
        userId: originalVersion.userId,
        userIdString: originalVersion.userIdString,
        image: originalVersion.image,
        previewImage: originalVersion.previewImage,
        prompt: originalVersion.prompt,
        embedding: originalVersion.embedding,
        // Set new segment-specific data for the clone
        segmentId: segmentId, // Link to the current segment
        source: "from_library",
        // [FIX] Removed the non-existent 'generationStatus' field.
      });
      versionToSelectId = newVersionId;
    }

    // Atomically update the segment to point to the correct image version
    // and CLEAR the selected video version.
    await ctx.db.patch(segmentId, {
      selectedVersionId: versionToSelectId,
      selectedVideoClipVersionId: undefined,
      isGenerating: false,
      error: undefined,
    });

    // Also trigger a story thumbnail update.
    const segment = await ctx.db.get(segmentId);
    if (segment) {
      await ctx.scheduler.runAfter(
        0,
        internal.story.internalUpdateStoryThumbnail,
        {
          storyId: segment.storyId,
        },
      );
    }
  },
});

// =================================================================
// >> Section 3: Image Generation Operations (Unchanged)
// =================================================================

export const regenerateImage = mutation({
  args: {
    segmentId: v.id("segments"),
    prompt: v.string(),
    characterId: v.optional(v.id("characters")),
  },
  async handler(ctx, args) {
    const { userId } = await verifySegmentOwner(ctx, args.segmentId);
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
        characterId: args.characterId,
      },
    );
  },
});

export const editImage = mutation({
  args: {
    segmentId: v.id("segments"),
    versionIdToEdit: v.id("imageVersions"),
    // [FIX] Use the correct argument names to match the internal action
    newInstruction: v.string(),
    originalPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await verifySegmentOwner(ctx, args.segmentId);
    await consumeCreditsHelper(ctx, userId, CREDIT_COSTS.IMAGE_GENERATION);

    await ctx.db.patch(args.segmentId, {
      isGenerating: true,
      error: undefined,
    });

    // [FIX] Pass all the correct arguments through to the action
    await ctx.scheduler.runAfter(
      0,
      internal.replicate.editSegmentImageUsingPrompt,
      {
        segmentId: args.segmentId,
        versionIdToEdit: args.versionIdToEdit,
        newInstruction: args.newInstruction,
        originalPrompt: args.originalPrompt,
      },
    );
  },
});

// =================================================================
// >> Section 4: Segment Management & CRUD (Unchanged)
// =================================================================

export const addSegment = mutation({
  args: { storyId: v.id("story") },
  handler: async (ctx, { storyId }) => {
    await verifyStoryOwner(ctx, storyId);

    const lastSegment = await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) => q.eq("storyId", storyId))
      .order("desc")
      .first();

    const newOrder = lastSegment ? lastSegment.order + 1 : 0;

    const newSegmentId = await ctx.db.insert("segments", {
      storyId,
      order: newOrder,
      text: "New scene...",
      isGenerating: false,
    });

    return newSegmentId;
  },
});

export const updateSegmentText = mutation({
  args: {
    segmentId: v.id("segments"),
    text: v.string(),
  },
  async handler(ctx, args) {
    await verifySegmentOwner(ctx, args.segmentId);
    await ctx.db.patch(args.segmentId, { text: args.text });
  },
});

export const reorderSegments = mutation({
  args: {
    storyId: v.id("story"),
    segmentIds: v.array(v.id("segments")),
  },
  handler: async (ctx, { storyId, segmentIds }) => {
    await verifyStoryOwner(ctx, storyId);

    const updatePromises = segmentIds.map((segmentId, index) =>
      ctx.db.patch(segmentId, { order: index }),
    );

    await Promise.all(updatePromises);
    await ctx.scheduler.runAfter(
      0,
      internal.story.internalUpdateStoryThumbnail,
      {
        storyId,
      },
    );
  },
});

export const deleteSegment = mutation({
  args: { segmentId: v.id("segments") },
  handler: async (ctx, { segmentId }) => {
    const { segment: segmentToDelete } = await verifySegmentOwner(
      ctx,
      segmentId,
    );

    const [imageVersions, videoClipVersions] = await Promise.all([
      ctx.db
        .query("imageVersions")
        .withIndex("by_segment", (q) => q.eq("segmentId", segmentId))
        .collect(),
      ctx.db
        .query("videoClipVersions")
        .withIndex("by_segment", (q) => q.eq("segmentId", segmentId))
        .collect(),
    ]);

    // [REFACTORED] New safe deletion logic with reverse lookup.
    const storageIdsToDelete = new Set<Id<"_storage">>();

    // 1. Check image assets for sharing and collect safe ones.
    for (const version of imageVersions) {
      // Check main image
      const imageRefs = await ctx.db
        .query("imageVersions")
        .withIndex("by_image", (q) => q.eq("image", version.image))
        .collect();
      if (imageRefs.length <= 1) {
        storageIdsToDelete.add(version.image);
      }
      // Check preview image
      if (version.previewImage) {
        const previewImageRefs = await ctx.db
          .query("imageVersions")
          .withIndex("by_previewImage", (q) =>
            q.eq("previewImage", version.previewImage!),
          )
          .collect();
        if (previewImageRefs.length <= 1) {
          storageIdsToDelete.add(version.previewImage);
        }
      }
    }

    // 2. Check video assets for sharing and collect safe ones.
    for (const clip of videoClipVersions) {
      // Check main video
      if (clip.storageId) {
        const videoRefs = await ctx.db
          .query("videoClipVersions")
          .withIndex("by_storageId", (q) => q.eq("storageId", clip.storageId!))
          .collect();
        if (videoRefs.length <= 1) {
          storageIdsToDelete.add(clip.storageId);
        }
      }
      // Check poster image
      if (clip.posterStorageId) {
        const posterRefs = await ctx.db
          .query("videoClipVersions")
          .withIndex("by_posterStorageId", (q) =>
            q.eq("posterStorageId", clip.posterStorageId!),
          )
          .collect();
        if (posterRefs.length <= 1) {
          storageIdsToDelete.add(clip.posterStorageId);
        }
      }
    }

    // 3. Perform deletions.
    // Delete only the storage assets that are not shared.
    const storageDeletionPromises = Array.from(storageIdsToDelete).map((id) =>
      ctx.storage.delete(id),
    );

    // Always delete the database records for the versions and the segment itself.
    const dbDeletionPromises = [
      ...imageVersions.map((v) => ctx.db.delete(v._id)),
      ...videoClipVersions.map((c) => ctx.db.delete(c._id)),
      ctx.db.delete(segmentId),
    ];

    await Promise.all([...storageDeletionPromises, ...dbDeletionPromises]);

    // 4. Re-order subsequent segments (this logic remains the same).
    const subsequentSegments = await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) =>
        q.eq("storyId", segmentToDelete.storyId),
      )
      .filter((q) => q.gt(q.field("order"), segmentToDelete.order))
      .order("asc")
      .collect();

    await Promise.all(
      subsequentSegments.map((segment) =>
        ctx.db.patch(segment._id, { order: segment.order - 1 }),
      ),
    );

    await ctx.scheduler.runAfter(
      0,
      internal.story.internalUpdateStoryThumbnail,
      {
        storyId: segmentToDelete.storyId,
      },
    );
  },
});

// =================================================================
// >> Section 5: Internal Helpers & Legacy Story Generation
// =================================================================

export const get = query({
  args: { id: v.id("segments") },
  handler: async (ctx, args) => {
    try {
      const { segment } = await verifySegmentOwner(ctx, args.id);
      return segment;
    } catch (error) {
      return null;
    }
  },
});

export const getSegments = internalQuery({
  args: { storyId: v.id("story") },
  async handler(ctx, args) {
    return await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) => q.eq("storyId", args.storyId))
      .order("asc")
      .collect();
  },
});

export const getSegmentInternal = internalQuery({
  args: { segmentId: v.id("segments") },
  async handler(ctx, args) {
    return await ctx.db.get(args.segmentId);
  },
});

export const getVideoClipVersionInternal = internalQuery({
  args: { versionId: v.id("videoClipVersions") },
  async handler(ctx, { versionId }) {
    return await ctx.db.get(versionId);
  },
});

export const updateVideoClipVersion = internalMutation({
  args: {
    videoClipVersionId: v.id("videoClipVersions"),
    storageId: v.optional(v.id("_storage")),
    generationStatus: v.optional(videoClipGenerationStatusValidator),
    statusMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { videoClipVersionId, ...rest } = args;
    await ctx.db.patch(videoClipVersionId, rest);
  },
});

export const internalLinkVideoToSegment = internalMutation({
  args: {
    segmentId: v.id("segments"),
    videoClipVersionId: v.id("videoClipVersions"),
  },
  handler: async (ctx, { segmentId, videoClipVersionId }) => {
    // [FIX] When a new video is generated and linked, it becomes the selected
    // version, so the selected image must be deselected.
    await ctx.db.patch(segmentId, {
      selectedVideoClipVersionId: videoClipVersionId,
      selectedVersionId: undefined, // [CORRECTION] Use undefined instead of null
      isGenerating: false,
      error: undefined,
    });
  },
});

export const getImageToVideoGenerationData = internalQuery({
  args: {
    segmentId: v.id("segments"),
    imageVersionId: v.id("imageVersions"),
  },
  handler: async (ctx, { segmentId, imageVersionId }) => {
    const segment = await ctx.db.get(segmentId);
    if (!segment) throw new Error("Segment not found");
    const story = await ctx.db.get(segment.storyId);
    if (!story) throw new Error("Story not found");
    const imageVersion = await ctx.db.get(imageVersionId);
    if (!imageVersion) throw new Error("Image version not found");
    const imageUrl = imageVersion.image
      ? await ctx.storage.getUrl(imageVersion.image)
      : null;
    if (!imageUrl) throw new Error("Could not get URL for start image.");

    return {
      userId: story.userId,
      segmentText: segment.text,
      storyStyle: story.stylePrompt,
      imageUrl: imageUrl,
      imagePrompt: imageVersion.prompt, // [FIX] Add the missing prompt
    };
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

      const imageGenerationSuccess = await ctx.runAction(
        internal.replicate.regenerateSegmentImageUsingPrompt,
        {
          segmentId,
          prompt,
        },
      );

      if (!imageGenerationSuccess) {
        return { success: false, error: "Image generation sub-task failed." };
      }

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

function getSystemPrompt(context?: string) {
  const defaultStyle = "A vibrant, cinematic anime style.";
  const contextString =
    context || `{"style_bible": {"visual_theme": "${defaultStyle}"}}`;

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
    // Ignore parsing errors
  }

  return `You are an expert prompt engineer for text-to-image models. Your mission is to generate a high-quality, detailed image prompt **IN ENGLISH**.
You will be given a "Style Bible" and a "Scene Description". Both might be in a language other than English. You must first understand their meaning and then synthesize them into a single, cohesive, and descriptive prompt for an image generation model.
**IMPORTANT RULES**:
1.  **Output Language**: The final output prompt inside the JSON object MUST be in **ENGLISH**.
2.  **Synthesize, Don't Just Translate**: Understand the artistic direction from the Style Bible and the narrative moment from the Scene Description, and combine them into a powerful visual instruction.
3.  **Technical Details**: Incorporate advanced photographic and artistic terms.
4.  **Adherence**: Strictly adhere to the visual and thematic elements described in the Style Bible.
5.  **Final Prompt Structure**: A series of descriptive phrases, separated by commas, incorporating these keywords: "${dynamicKeywords}".
6.  **Output Format**: Respond with ONLY a single JSON object with one key: "prompt".
**STYLE BIBLE (JSON)**:
${contextString}
**SCENE DESCRIPTION (Text)**:
The scene to illustrate will be provided in the user message.
`;
}

// =================================================================
// >> Section 6: Queries for UI Components (NEW)
// =================================================================

/**
 * [NEW] A query to get all segments for a story, including the preview
 * image URL for each segment's selected version. This is used on the
 * main story detail page to display the list of segment cards.
 */
export const getSegmentsWithPreview = query({
  args: { storyId: v.id("story") },
  async handler(ctx, args) {
    await verifyStoryOwner(ctx, args.storyId);

    const segments = await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) => q.eq("storyId", args.storyId))
      .order("asc")
      .collect();

    return Promise.all(
      segments.map(async (segment) => {
        let previewImageUrl: string | null = null;
        let posterUrl: string | null = null;
        let videoUrl: string | null = null;

        // Fetch preview for the selected image version, if any
        if (segment.selectedVersionId) {
          const selectedVersion = await ctx.db.get(segment.selectedVersionId);
          if (selectedVersion?.previewImage) {
            try {
              previewImageUrl = await ctx.storage.getUrl(
                selectedVersion.previewImage,
              );
            } catch (e) {
              console.error(
                `Failed to get URL for segment ${segment._id} image preview.`,
                e,
              );
            }
          }
        }

        // Fetch preview for the selected video clip version, if any
        if (segment.selectedVideoClipVersionId) {
          const selectedClip = await ctx.db.get(
            segment.selectedVideoClipVersionId,
          );
          if (selectedClip) {
            try {
              const [fetchedVideoUrl, fetchedPosterUrl] = await Promise.all([
                selectedClip.storageId
                  ? ctx.storage.getUrl(selectedClip.storageId)
                  : null,
                selectedClip.posterStorageId
                  ? ctx.storage.getUrl(selectedClip.posterStorageId)
                  : null,
              ]);
              videoUrl = fetchedVideoUrl;
              posterUrl = fetchedPosterUrl;
            } catch (e) {
              console.error(
                `Failed to get URL for segment ${segment._id} video preview.`,
                e,
              );
            }
          }
        }

        return {
          ...segment,
          previewImageUrl,
          posterUrl,
          videoUrl,
        };
      }),
    );
  },
});
