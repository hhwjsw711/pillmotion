import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { verifyStoryOwner } from "./lib/auth";
import { ConvexError } from "convex/values";

export const getVideoRenderData = query({
  args: { storyId: v.id("story") },
  async handler(ctx, args) {
    // 1. 验证用户对故事的所有权
    const { story } = await verifyStoryOwner(ctx, args.storyId);

    // 2. 获取故事的所有片段，按顺序排列
    const segments = await ctx.db
      .query("segments")
      .withIndex("by_story_order", (q) => q.eq("storyId", args.storyId))
      .order("asc")
      .collect();

    // 3. 对每个片段，获取其“已选定”的视频片段的URL
    const clips = await Promise.all(
      segments.map(async (segment) => {
        // [关键] 检查是否存在 selectedVideoClipVersionId
        if (segment.selectedVideoClipVersionId) {
          const videoClipVersion = await ctx.db.get(
            segment.selectedVideoClipVersionId,
          );

          // [关键] 从 videoClipVersions 记录中获取 storageId
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

        // 如果一个片段没有选定的视频，它将被跳过，不会包含在最终的渲染中
        return null;
      }),
    );

    // 4. 过滤掉所有为 null 的项，确保我们只处理有效的视频数据
    const filteredClips = clips.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    );

    return {
      clips: filteredClips,
      bgmUrl: story.bgmUrl ?? null,
    };
  },
});

// [NEW] Mutation to save the final stitched video, triggered by the user from the client.
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

    // Verify ownership before patching
    await verifyStoryOwner(ctx, videoVersion.storyId);

    // Update the record with the final video's storageId.
    // The generationStatus remains 'generated'. We are just adding the final asset.
    await ctx.db.patch(videoVersionId, {
      storageId: storageId,
      statusMessage: "Video successfully stitched and saved by user.",
    });
  },
});
