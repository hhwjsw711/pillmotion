import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { auth } from "../auth";

/**
 * Gets the user ID of the authenticated user.
 * @param ctx - The query or mutation context.
 * @returns The user ID.
 * @throws A ConvexError if the user is not authenticated.
 */
export async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const userId = await auth.getUserId(ctx);
  if (!userId) {
    throw new ConvexError("User not authenticated.");
  }
  return userId;
}

/**
 * Verifies that the authenticated user is the owner of a story.
 * @param ctx - The query or mutation context.
 * @param storyId - The ID of the story to verify.
 * @returns The story document and the user ID.
 * @throws A ConvexError if the user is not the owner or the story doesn't exist.
 */
export async function verifyStoryOwner(
  ctx: QueryCtx | MutationCtx,
  storyId: Id<"story">,
) {
  const userId = await getAuthenticatedUser(ctx);
  const story = await ctx.db.get(storyId);
  if (!story) {
    throw new ConvexError("Story not found.");
  }
  if (story.userId !== userId) {
    throw new ConvexError("User is not the owner of this story.");
  }
  return { story, userId };
}

/**
 * Verifies that the authenticated user is the owner of a segment.
 * @param ctx - The query or mutation context.
 * @param segmentId - The ID of the segment to verify.
 * @returns The segment, its parent story, and the user ID.
 * @throws A ConvexError if the user is not the owner or the segment/story doesn't exist.
 */
export async function verifySegmentOwner(
  ctx: QueryCtx | MutationCtx,
  segmentId: Id<"segments">,
) {
  const userId = await getAuthenticatedUser(ctx);
  const segment = await ctx.db.get(segmentId);
  if (!segment) {
    throw new ConvexError("Segment not found.");
  }
  // Reuse the story owner verification logic
  const { story } = await verifyStoryOwner(ctx, segment.storyId);
  return { segment, story, userId };
}
