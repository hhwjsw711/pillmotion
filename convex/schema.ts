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
  "from_library",
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
  v.literal("ai_edited"),
  v.literal("from_library"),
);
export type VideoVersionSource = Infer<typeof videoVersionSourceValidator>;

export const videoClipContextValidator = v.union(
  // 类型一：文生视频的上下文
  v.object({
    type: v.literal("text_to_video"),
    prompt: v.string(),
  }),
  // 类型二：图生视频的上下文
  v.object({
    type: v.literal("image_to_video"),
    sourceImageId: v.id("imageVersions"),
    prompt: v.optional(v.string()), // prompt在这里是可选的
  }),
  // 类型三：首尾帧视频（转场）的上下文
  v.object({
    type: v.literal("transition"),
    startImageId: v.id("imageVersions"),
    endImageId: v.id("imageVersions"),
    prompt: v.optional(v.string()), // 转场效果的文字描述
  }),
  // 类型四：视频转绘（为未来预留）
  v.object({
    type: v.literal("video_to_video"),
    sourceVideoClipId: v.id("videoClipVersions"),
    prompt: v.string(), // 转绘的指令是必需的
  }),
);

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
    bgmUrl: v.optional(v.string()),
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
    userIdString: v.string(), // 新增
    prompt: v.optional(v.string()),
    image: v.id("_storage"),
    previewImage: v.id("_storage"),
    source: imageVersionSourceValidator,
    embedding: v.optional(v.array(v.float64())),
  })
    .index("by_segment", ["segmentId"])
    .index("by_user", ["userId"]) // 保留此索引
    .index("by_user_string", ["userIdString"]) // 新增此索引
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["userIdString"], // 更新过滤器
    }),
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
    segmentId: v.id("segments"),
    userId: v.id("users"),
    userIdString: v.string(),
    context: videoClipContextValidator,
    storageId: v.optional(v.id("_storage")),
    posterStorageId: v.optional(v.id("_storage")),
    generationStatus: videoClipGenerationStatusValidator,
    processingStatus: v.optional(videoProcessingStatusValidator),
    statusMessage: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
    generationId: v.optional(v.string()),
  })
    .index("by_segment", ["segmentId"])
    .index("by_user", ["userId"])
    .index("by_user_string", ["userIdString"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["userIdString"],
    }),
});

export default schema;
