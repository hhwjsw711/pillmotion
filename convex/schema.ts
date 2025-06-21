import { defineSchema, defineTable } from "convex/server";
import { StreamIdValidator } from "@convex-dev/persistent-text-streaming";
import { authTables } from "@convex-dev/auth/server";
import { v, Infer } from "convex/values";

export const CREDIT_COSTS = {
  CHAT_COMPLETION: 1,
  IMAGE_GENERATION: 10,
  VIDEO_CLIP_GENERATION: 100,
} as const;
export const creditCostValidator = v.union(
  v.literal(CREDIT_COSTS.CHAT_COMPLETION),
  v.literal(CREDIT_COSTS.IMAGE_GENERATION),
  v.literal(CREDIT_COSTS.VIDEO_CLIP_GENERATION),
);
export type CreditCost = Infer<typeof creditCostValidator>;

export const priceIdValidator = v.union(
  v.literal("small"),
  v.literal("medium"),
  v.literal("large"),
);
export type PriceId = Infer<typeof priceIdValidator>;

export const CURRENCIES = {
  USD: "usd",
  EUR: "eur",
} as const;
export const currencyValidator = v.union(
  v.literal(CURRENCIES.USD),
  v.literal(CURRENCIES.EUR),
);
export type Currency = Infer<typeof currencyValidator>;

export const INTERVALS = {
  MONTH: "month",
  YEAR: "year",
} as const;
export const intervalValidator = v.union(
  v.literal(INTERVALS.MONTH),
  v.literal(INTERVALS.YEAR),
);
export type Interval = Infer<typeof intervalValidator>;

export const PLANS = {
  FREE: "free",
  PRO: "pro",
} as const;
export const planKeyValidator = v.union(
  v.literal(PLANS.FREE),
  v.literal(PLANS.PRO),
);
export type PlanKey = Infer<typeof planKeyValidator>;

const priceValidator = v.object({
  stripeId: v.string(),
  amount: v.number(),
});
const pricesValidator = v.object({
  [CURRENCIES.USD]: priceValidator,
  [CURRENCIES.EUR]: priceValidator,
});

export const storyStatusValidator = v.union(
  v.literal("draft"),
  v.literal("unpublished"),
  v.literal("published"),
  v.literal("archived"),
);
export type StoryStatus = Infer<typeof storyStatusValidator>;

export const storyGenerationStatusValidator = v.union(
  v.literal("idle"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("error"),
);
export type StoryGenerationStatus = Infer<
  typeof storyGenerationStatusValidator
>;

export const storyFormatValidator = v.union(
  v.literal("vertical"),
  v.literal("horizontal"),
);
export type StoryFormat = Infer<typeof storyFormatValidator>;

export const IMAGE_VERSION_SOURCES = [
  "ai_generated",
  "user_uploaded",
  "ai_edited",
] as const;
export const imageVersionSourceValidator = v.union(
  ...IMAGE_VERSION_SOURCES.map((s) => v.literal(s)),
);
export type ImageVersionSource = Infer<typeof imageVersionSourceValidator>;

export const storyVideoGenerationStatusValidator = v.union(
  v.literal("idle"),
  v.literal("pending"),
  v.literal("generating_clips"),
  v.literal("merging_clips"),
  v.literal("generated"),
  v.literal("error"),
);
export type StoryVideoGenerationStatus = Infer<
  typeof storyVideoGenerationStatusValidator
>;

export const videoClipGenerationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("generating"),
  v.literal("generated"),
  v.literal("error"),
);
export type VideoClipGenerationStatus = Infer<
  typeof videoClipGenerationStatusValidator
>;

export const videoProcessingStatusValidator = v.union(
  v.literal("idle"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("error"),
);

export const videoVersionSourceValidator = v.union(
  v.literal("ai_generated"),
  v.literal("user_uploaded"),
);
export type VideoVersionSource = Infer<typeof videoVersionSourceValidator>;

export const videoClipTypeValidator = v.union(
  v.literal("image-to-video"),
  v.literal("text-to-video"),
  v.literal("transition"),
);
export type VideoClipType = Infer<typeof videoClipTypeValidator>;

const schema = defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    customerId: v.optional(v.string()),
    credits: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("customerId", ["customerId"]),
  plans: defineTable({
    key: planKeyValidator,
    stripeId: v.string(),
    name: v.string(),
    description: v.string(),
    prices: v.object({
      [INTERVALS.MONTH]: pricesValidator,
      [INTERVALS.YEAR]: pricesValidator,
    }),
  })
    .index("key", ["key"])
    .index("stripeId", ["stripeId"]),
  subscriptions: defineTable({
    userId: v.id("users"),
    planId: v.id("plans"),
    priceStripeId: v.string(),
    stripeId: v.string(),
    currency: currencyValidator,
    interval: intervalValidator,
    status: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  })
    .index("userId", ["userId"])
    .index("stripeId", ["stripeId"]),
  userMessages: defineTable({
    prompt: v.string(),
    responseStreamId: StreamIdValidator,
  }).index("by_stream", ["responseStreamId"]),
  story: defineTable({
    updatedAt: v.number(),
    userId: v.id("users"),
    title: v.string(),
    script: v.string(),
    status: storyStatusValidator,
    generationStatus: v.optional(storyGenerationStatusValidator),
    format: v.optional(storyFormatValidator),
    context: v.optional(v.string()),
    generationId: v.optional(v.string()),
    stylePrompt: v.optional(v.string()),
    thumbnailUrl: v.optional(v.union(v.string(), v.null())),
    selectedVideoVersionId: v.optional(v.id("videoVersions")),
  })
    .index("userId", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_status", ["status"])
    .searchIndex("search_story", { searchField: "script" }),
  segments: defineTable({
    storyId: v.id("story"),
    text: v.string(),
    order: v.number(),
    isGenerating: v.boolean(),
    selectedVersionId: v.optional(v.id("imageVersions")),
    error: v.optional(v.string()),
    selectedVideoClipVersionId: v.optional(v.id("videoClipVersions")),
  })
    .index("by_story", ["storyId"])
    .index("by_story_order", ["storyId", "order"]),
  imageVersions: defineTable({
    segmentId: v.id("segments"),
    userId: v.id("users"),
    prompt: v.optional(v.string()),
    image: v.id("_storage"),
    previewImage: v.id("_storage"),
    source: imageVersionSourceValidator,
  }).index("by_segment", ["segmentId"]),
  videoVersions: defineTable({
    storyId: v.id("story"),
    userId: v.id("users"),
    storageId: v.optional(v.id("_storage")),
    source: videoVersionSourceValidator,
    generationStatus: storyVideoGenerationStatusValidator,
    processingStatus: v.optional(videoProcessingStatusValidator),
    generationId: v.optional(v.string()),
    statusMessage: v.optional(v.string()),
  }).index("by_story", ["storyId"]),
  videoClipVersions: defineTable({
    videoVersionId: v.optional(v.id("videoVersions")),
    segmentId: v.id("segments"),
    userId: v.id("users"),
    type: videoClipTypeValidator,
    sourceImageVersionId: v.optional(v.id("imageVersions")), // Start frame
    endImageVersionId: v.optional(v.id("imageVersions")), // End frame (for transitions)
    storageId: v.optional(v.id("_storage")),
    source: videoVersionSourceValidator,
    prompt: v.optional(v.string()),
    generationStatus: videoClipGenerationStatusValidator, // Use the new validator
    processingStatus: v.optional(videoProcessingStatusValidator),
    generationId: v.optional(v.string()),
    statusMessage: v.optional(v.string()),
  })
    .index("by_segment", ["segmentId"])
    .index("by_videoVersion", ["videoVersionId"]),
});

export default schema;
