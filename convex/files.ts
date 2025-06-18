import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const getUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    const urls = await Promise.all(
      args.storageIds.map((storageId) => ctx.storage.getUrl(storageId)),
    );
    // Filter out nulls in case some URLs failed to generate
    return urls.filter((url): url is string => url !== null);
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  const userId = await auth.getUserId(ctx);
  if (!userId) {
    throw new Error("User must be authenticated to generate an upload URL.");
  }
  return await ctx.storage.generateUploadUrl();
});
