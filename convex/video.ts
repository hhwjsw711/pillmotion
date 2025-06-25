import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { verifySegmentOwner, verifyStoryOwner } from "./lib/auth";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import type { DatabaseWriter } from "./_generated/server";

/**
 * [HELPER FUNCTION - ROBUST VERSION]
 * This function is now more robust. It fetches the document first and checks
 * its properties to determine if it's an image or video, rather than relying on
 * TypeScript casting. This makes the backend more resilient to client-side errors.
 */
async function resolveSourceToImageVersion(
  db: DatabaseWriter,
  args: {
    sourceId: Id<"imageVersions"> | Id<"videoClipVersions">;
    userId: Id<"users">;
    segmentId: Id<"segments">;
    frameType: "start" | "end"; // [ADD]
  },
): Promise<{ imageVersionId: Id<"imageVersions">; wasCreated: boolean }> {
  const { sourceId, userId, segmentId, frameType } = args; // [CHANGE]

  // Fetch the document without assuming its type.
  const doc = await db.get(sourceId);

  if (!doc) {
    throw new ConvexError(`Source asset not found for ID: ${sourceId}`);
  }

  // Check if it's an imageVersion by looking for a unique field.
  if ("image" in doc) {
    return {
      imageVersionId: doc._id as Id<"imageVersions">,
      wasCreated: false,
    }; // It's already an image.
  }

  // If not, it must be a videoClipVersion.
  if ("posterStorageId" in doc && doc.posterStorageId) {
    // [CHANGE] This is the core logic fix.
    // For a 'start' frame, we MUST use the video's LAST frame.
    // For an 'end' frame, we use the video's FIRST frame (the poster).
    const imageToUse =
      frameType === "start" && doc.lastFramePosterStorageId
        ? doc.lastFramePosterStorageId
        : doc.posterStorageId;

    // Create a new imageVersion from the video's poster.
    const newImageVersionId = await db.insert("imageVersions", {
      userId: userId,
      userIdString: userId,
      segmentId: segmentId,
      image: imageToUse, // [CHANGE]
      previewImage: imageToUse, // [CHANGE]
      source: "frame_extracted",
    });
    return { imageVersionId: newImageVersionId, wasCreated: true };
  }

  // If it's a video without a poster, we can't proceed.
  throw new ConvexError(
    `Video clip ${doc._id} does not have a poster image to use for transition.`,
  );
}

export const generateTransition = mutation({
  args: {
    segmentId: v.id("segments"),
    startFrameSourceId: v.union(
      v.id("imageVersions"),
      v.id("videoClipVersions"),
    ),
    endFrameSourceId: v.union(v.id("imageVersions"), v.id("videoClipVersions")),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await verifySegmentOwner(ctx, args.segmentId);

    // [CHANGE] Pass 'frameType' to the helper and get creation status
    const startImage = await resolveSourceToImageVersion(ctx.db, {
      sourceId: args.startFrameSourceId,
      userId: userId,
      segmentId: args.segmentId,
      frameType: "start",
    });

    // [CHANGE] Pass 'frameType' to the helper and get creation status
    const endImage = await resolveSourceToImageVersion(ctx.db, {
      sourceId: args.endFrameSourceId,
      userId: userId,
      segmentId: args.segmentId,
      frameType: "end",
    });

    // [BUG FIX] Schedule embedding generation for newly created frame images
    if (startImage.wasCreated) {
      await ctx.scheduler.runAfter(0, internal.media.generateEmbeddingForImage, {
        imageVersionId: startImage.imageVersionId,
      });
    }
    if (endImage.wasCreated) {
      await ctx.scheduler.runAfter(0, internal.media.generateEmbeddingForImage, {
        imageVersionId: endImage.imageVersionId,
      });
    }

    const newVideoClipVersionId = await ctx.db.insert("videoClipVersions", {
      segmentId: args.segmentId,
      userId: userId,
      userIdString: userId,
      context: {
        type: "transition",
        startImageId: startImage.imageVersionId,
        endImageId: endImage.imageVersionId,
        prompt: args.prompt,
      },
      generationStatus: "pending",
      processingStatus: "idle",
    });

    await ctx.scheduler.runAfter(0, internal.replicate.generateTransitionClip, {
      userId: userId,
      videoClipVersionId: newVideoClipVersionId,
    });

    return newVideoClipVersionId;
  },
});

export const getVideoClipVersion = internalQuery({
  args: { clipId: v.id("videoClipVersions") },
  handler: async (ctx, { clipId }) => {
    return await ctx.db.get(clipId);
  },
});

export const getVideoRenderData = query({
  args: { storyId: v.id("story") },
  async handler(ctx, args) {
    const { story } = await verifyStoryOwner(ctx, args.storyId);

    const segments = await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) => q.eq("storyId", args.storyId))
      .order("asc")
      .collect();

    const clips = await Promise.all(
      segments.map(async (segment) => {
        if (segment.selectedVideoClipVersionId) {
          const videoClipVersion = await ctx.db.get(
            segment.selectedVideoClipVersionId,
          );

          if (videoClipVersion?.storageId) {
            const videoUrl = await ctx.storage.getUrl(
              videoClipVersion.storageId,
            );
            if (videoUrl) {
              return {
                type: "video" as const,
                url: videoUrl,
              };
            }
          }
        }
        return null;
      }),
    );

    const filteredClips = clips.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    );

    return {
      clips: filteredClips,
      bgmUrl: story.bgmUrl ?? null,
    };
  },
});

export const saveStitchedVideo = mutation({
  args: {
    videoVersionId: v.id("videoVersions"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { videoVersionId, storageId }) => {
    const videoVersion = await ctx.db.get(videoVersionId);
    if (!videoVersion) {
      throw new ConvexError("Video version not found.");
    }

    await verifyStoryOwner(ctx, videoVersion.storyId);

    await ctx.db.patch(videoVersionId, {
      storageId: storageId,
      statusMessage: "Video successfully stitched and saved by user.",
    });
  },
});
