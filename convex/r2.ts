import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { R2, R2Callbacks } from "@convex-dev/r2";
import { DataModel } from "./_generated/dataModel";
const r2 = new R2(components.r2);

const callbacks: R2Callbacks = internal.r2;

export const {
  generateUploadUrl,
  syncMetadata,

  // These aren't used in the example, but can be exported this way to utilize
  // the permission check callbacks.
  getMetadata,
  listMetadata,
  deleteObject,
  onSyncMetadata,
} = r2.clientApi<DataModel>({
  // The checkUpload callback is used for both `generateUploadUrl` and
  // `syncMetadata`.
  // In any of these checks, throw an error to reject the request.
  checkUpload: async (_ctx, _bucket) => {
    // const user = await userFromAuth(ctx);
    // ...validate that the user can upload to this bucket
  },
  checkReadKey: async (_ctx, _bucket, _key) => {
    // const user = await userFromAuth(ctx);
    // ...validate that the user can read this key
  },
  checkReadBucket: async (_ctx, _bucket) => {
    // const user = await userFromAuth(ctx);
    // ...validate that the user can read this bucket
  },
  checkDelete: async (_ctx, _bucket, _key) => {
    // const user = await userFromAuth(ctx);
    // ...validate that the user can delete this key
  },
  onUpload: async (ctx, bucket, key) => {
    // ...do something with the key
    // This technically runs in the `syncMetadata` mutation, as the upload
    // is performed from the client side. Will run if using the `useUploadFile`
    // hook, or if `syncMetadata` function is called directly. Runs after the
    // `checkUpload` callback.
    //
    // Note: If you want to associate the newly uploaded file with some other
    // data, like a message, useUploadFile returns the key in the client so you
    // can do it there.
    await ctx.db.insert("media", {
      bucket,
      key,
    });
  },
  onDelete: async (ctx, bucket, key) => {
    // Delete related data from your database, etc.
    // Runs after the `checkDelete` callback.
    // Alternatively, you could have your own `deleteImage` mutation that calls
    // the r2 component's `deleteObject` function.
    const media = await ctx.db
      .query("media")
      .withIndex("bucket_key", (q) => q.eq("bucket", bucket).eq("key", key))
      .unique();
    if (media) {
      await ctx.db.delete(media._id);
    }
  },
  onSyncMetadata: async (ctx, args) => {
    // `args` contains `{ key, bucket, isNew }`. We use the key to get
    // the full metadata from R2, which includes the content type.
    const metadata = await r2.getMetadata(ctx, args.key);
    if (metadata?.contentType) {
      const media = await ctx.db
        .query("media")
        .withIndex("bucket_key", (q) =>
          q.eq("bucket", args.bucket).eq("key", args.key),
        )
        .unique();
      if (media) {
        await ctx.db.patch(media._id, { contentType: metadata.contentType });
      }
    }
  },
  callbacks,
});

export const listMedia = query({
  args: {},
  handler: async (ctx) => {
    const allMedia = await ctx.db.query("media").collect();
    return Promise.all(
      allMedia.map(async (media) => ({
        ...media,
        url: await r2.getUrl(media.key),
      })),
    );
  },
});

export const updateMediaCaption = mutation({
  args: {
    id: v.id("media"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      caption: args.caption,
    });
  },
});

export const insertMedia = internalMutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("media", { key: args.key, bucket: r2.config.bucket });
  },
});
