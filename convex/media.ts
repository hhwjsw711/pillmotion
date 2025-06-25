import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  ActionCtx,
} from "./_generated/server";
import Replicate from "replicate";
import { Doc } from "./_generated/dataModel";
import { auth } from "./auth";
import OpenAI from "openai";

// --- Types for Search Results ---
export type ImageSearchResult = Doc<"imageVersions"> & {
  resultType: "image";
  previewUrl: string | null;
  _score: number;
};

export type VideoSearchResult = Doc<"videoClipVersions"> & {
  resultType: "video";
  previewUrl: string | null; // This is the source image for i2v, if it exists
  posterUrl: string | null; // [NEW] This is the video's own poster/thumbnail
  videoUrl: string | null;
  _score: number;
};

export type SearchResult = ImageSearchResult | VideoSearchResult;

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

const openai = new OpenAI();

const CLIP_MODEL_AND_VERSION =
  "andreasjansson/clip-features:75b33f253f7714a281ad3e9b28f63e3232d583716ef6718f2e46641077ea040a";

async function getTextEmbedding(text: string): Promise<number[] | null> {
  if (!text) return null;
  try {
    const output = (await replicate.run(CLIP_MODEL_AND_VERSION, {
      input: {
        inputs: text,
      },
    })) as { input: string; embedding: number[] }[];
    return output[0]?.embedding;
  } catch (error) {
    console.error("Failed to get text embedding from Replicate", error);
    return null;
  }
}

async function getImageEmbedding(imageUrl: string): Promise<number[] | null> {
  if (!imageUrl) return null;
  try {
    const output = (await replicate.run(CLIP_MODEL_AND_VERSION, {
      input: {
        image: imageUrl,
      },
    })) as { input: string; embedding: number[] }[];
    return output[0]?.embedding;
  } catch (error) {
    console.error("Failed to get image embedding from Replicate", error);
    return null;
  }
}

// =================================================================
// >> Section 1: Embedding Generation (FIXED)
// =================================================================

export const storeImageEmbedding = internalMutation({
  args: {
    imageVersionId: v.id("imageVersions"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, { imageVersionId, embedding }) => {
    await ctx.db.patch(imageVersionId, { embedding });
  },
});

export const generateEmbeddingForImage = internalAction({
  args: { imageVersionId: v.id("imageVersions") },
  handler: async (ctx, { imageVersionId }) => {
    const version = await ctx.runQuery(
      internal.imageVersions.getVersionInternal,
      {
        versionId: imageVersionId,
      },
    );
    if (!version) {
      console.warn(`Image version ${imageVersionId} not found. Skipping.`);
      return;
    }

    let embedding: number[] | null = null;
    if (version.prompt) {
      embedding = await getTextEmbedding(version.prompt);
    } else if (version.image) {
      const imageUrl = await ctx.storage.getUrl(version.image);
      if (imageUrl) {
        embedding = await getImageEmbedding(imageUrl);
      } else {
        console.warn(`Could not get URL for source image of ${imageVersionId}`);
      }
    }

    if (embedding) {
      await ctx.runMutation(internal.media.storeImageEmbedding, {
        imageVersionId,
        embedding: embedding,
      });
    } else {
      console.warn(
        `Skipping embedding for image ${imageVersionId}, no suitable source found.`,
      );
    }
  },
});

export const storeVideoEmbedding = internalMutation({
  args: {
    videoClipVersionId: v.id("videoClipVersions"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, { videoClipVersionId, embedding }) => {
    await ctx.db.patch(videoClipVersionId, { embedding });
  },
});

export const generateEmbeddingForVideo = internalAction({
  args: { videoClipVersionId: v.id("videoClipVersions") },
  handler: async (ctx, { videoClipVersionId }) => {
    const videoVersion = await ctx.runQuery(
      internal.segments.getVideoClipVersionInternal,
      { versionId: videoClipVersionId },
    );

    if (!videoVersion) {
      console.warn(`Video clip version ${videoClipVersionId} not found.`);
      return;
    }

    let embedding: number[] | null = null;
    const { context } = videoVersion;

    // [FIX] Generalize the embedding logic to be more robust.
    // 1. Prioritize a text prompt if one exists.
    if ("prompt" in context && context.prompt) {
      embedding = await getTextEmbedding(context.prompt);
    }
    // 2. If no prompt, fall back to the poster image for a visual embedding.
    //    This correctly handles user uploads, transitions without prompts, etc.
    else if (videoVersion.posterStorageId) {
      const imageUrl = await ctx.storage.getUrl(videoVersion.posterStorageId);
      if (imageUrl) {
        embedding = await getImageEmbedding(imageUrl);
      } else {
        console.warn(
          `Could not get URL for poster of video ${videoClipVersionId}`,
        );
      }
    }

    if (embedding) {
      await ctx.runMutation(internal.media.storeVideoEmbedding, {
        videoClipVersionId,
        embedding: embedding,
      });
    } else {
      console.warn(
        `Skipping embedding for video ${videoClipVersionId}, no suitable source found. Context type: ${videoVersion.context.type}`,
      );
    }
  },
});

// =================================================================
// >> Section 2: Search & Retrieval (FIXED)
// =================================================================

async function translateToEnglishIfNeeded(text: string): Promise<string> {
  if (!/[\u4e00-\u9fa5]/.test(text)) {
    return text;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert translator. Translate the given text to English. Respond with only the English translation, without any explanations or quotation marks.",
        },
        { role: "user", content: text },
      ],
      temperature: 0,
    });
    return completion.choices[0]?.message?.content ?? text;
  } catch (error) {
    console.error("Failed to translate search text, using original.", error);
    return text;
  }
}

export const getBatchOfImages = internalQuery({
  args: { ids: v.array(v.id("imageVersions")) },
  handler: async (ctx, { ids }) => {
    const records = await Promise.all(ids.map((id) => ctx.db.get(id)));
    const nonNullRecords = records.filter(Boolean) as Doc<"imageVersions">[];
    return await Promise.all(
      nonNullRecords.map(async (record) => {
        const previewUrl = record.previewImage
          ? await ctx.storage.getUrl(record.previewImage)
          : null;
        return {
          resultType: "image" as const,
          ...record,
          previewUrl,
        };
      }),
    );
  },
});

export const getBatchOfVideos = internalQuery({
  args: { ids: v.array(v.id("videoClipVersions")) },
  handler: async (ctx, { ids }) => {
    const records = await Promise.all(ids.map((id) => ctx.db.get(id)));
    const nonNullRecords = records.filter(
      Boolean,
    ) as Doc<"videoClipVersions">[];
    return await Promise.all(
      nonNullRecords.map(async (record) => {
        const [videoUrl, posterUrl] = await Promise.all([
          record.storageId ? ctx.storage.getUrl(record.storageId) : null,
          record.posterStorageId
            ? ctx.storage.getUrl(record.posterStorageId)
            : null,
        ]);

        let previewUrl: string | null = null;
        if (record.context.type === "image_to_video") {
          const sourceImage = await ctx.db.get(record.context.sourceImageId);
          if (sourceImage?.previewImage) {
            previewUrl = await ctx.storage.getUrl(sourceImage.previewImage);
          }
        }

        return {
          resultType: "video" as const,
          ...record,
          previewUrl,
          videoUrl,
          posterUrl,
        };
      }),
    );
  },
});

export const getRecentMedia = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<SearchResult[]> => {
    const [images, videos] = await Promise.all([
      ctx.db
        .query("imageVersions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(10),
      ctx.db
        .query("videoClipVersions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(10),
    ]);

    const imagesWithData: ImageSearchResult[] = await Promise.all(
      images.map(async (record) => ({
        ...record,
        resultType: "image" as const,
        previewUrl: record.previewImage
          ? await ctx.storage.getUrl(record.previewImage)
          : null,
        _score: 0,
      })),
    );

    const videosWithData: VideoSearchResult[] = await Promise.all(
      videos.map(async (record) => {
        const [videoUrl, posterUrl] = await Promise.all([
          record.storageId ? ctx.storage.getUrl(record.storageId) : null,
          record.posterStorageId
            ? ctx.storage.getUrl(record.posterStorageId)
            : null,
        ]);

        let previewUrl: string | null = null;
        if (record.context.type === "image_to_video") {
          const sourceImage = await ctx.db.get(record.context.sourceImageId);
          if (sourceImage?.previewImage) {
            previewUrl = await ctx.storage.getUrl(sourceImage.previewImage);
          }
        }
        return {
          ...record,
          resultType: "video" as const,
          previewUrl,
          videoUrl,
          posterUrl,
          _score: 0,
        };
      }),
    );

    const combined: SearchResult[] = [...imagesWithData, ...videosWithData];
    combined.sort((a, b) => b._creationTime - a._creationTime);
    return combined.slice(0, 20);
  },
});

export const searchMedia = action({
  args: {
    searchText: v.optional(v.string()),
  },
  handler: async (
    ctx: ActionCtx,
    { searchText }: { searchText?: string },
  ): Promise<SearchResult[]> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    if (searchText) {
      const englishSearchText = await translateToEnglishIfNeeded(searchText);
      console.log(
        `Original search: "${searchText}", Translated to: "${englishSearchText}"`,
      );

      const queryEmbedding = await getTextEmbedding(englishSearchText);
      if (!queryEmbedding) return [];

      const userIdString = userId.toString();

      const [imageHits, videoHits] = await Promise.all([
        ctx.vectorSearch("imageVersions", "by_embedding", {
          vector: queryEmbedding,
          limit: 16,
          filter: (q) => q.eq("userIdString", userIdString),
        }),
        ctx.vectorSearch("videoClipVersions", "by_embedding", {
          vector: queryEmbedding,
          limit: 16,
          filter: (q) => q.eq("userIdString", userIdString),
        }),
      ]);

      const SCORE_THRESHOLD = 0.85;
      const filteredImageHits = imageHits.filter(
        (hit) => hit._score > SCORE_THRESHOLD,
      );
      const filteredVideoHits = videoHits.filter(
        (hit) => hit._score > SCORE_THRESHOLD,
      );

      const [images, videos] = await Promise.all([
        ctx.runQuery(internal.media.getBatchOfImages, {
          ids: filteredImageHits.map((h) => h._id),
        }),
        ctx.runQuery(internal.media.getBatchOfVideos, {
          ids: filteredVideoHits.map((h) => h._id),
        }),
      ]);

      const imageScoreMap = new Map(
        filteredImageHits.map((hit) => [hit._id, hit._score]),
      );
      const videoScoreMap = new Map(
        filteredVideoHits.map((hit) => [hit._id, hit._score]),
      );

      const scoredImages: ImageSearchResult[] = images.map((img) => ({
        ...img,
        _score: imageScoreMap.get(img._id)!,
      }));
      const scoredVideos: VideoSearchResult[] = videos.map((vid) => ({
        ...vid,
        _score: videoScoreMap.get(vid._id)!,
      }));

      const combinedResults: SearchResult[] = [
        ...scoredImages,
        ...scoredVideos,
      ];
      combinedResults.sort((a, b) => b._score - a._score);
      return combinedResults.slice(0, 20);
    } else {
      return await ctx.runQuery(internal.media.getRecentMedia, { userId });
    }
  },
});