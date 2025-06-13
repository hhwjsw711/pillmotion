import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { StreamIdValidator } from "@convex-dev/persistent-text-streaming";
import { v, Infer } from "convex/values";

export const CREDIT_COSTS = {
  CHAT_COMPLETION: 1,
  IMAGE_GENERATION: 10,
  VIDEO_GENERATION: 100,
} as const;
export const creditCostValidator = v.union(
  v.literal(CREDIT_COSTS.CHAT_COMPLETION),
  v.literal(CREDIT_COSTS.IMAGE_GENERATION),
  v.literal(CREDIT_COSTS.VIDEO_GENERATION),
);
export type CreditCost = Infer<typeof creditCostValidator>;

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

export const AVAILABLE_AITTS_VOICES = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
] as const;
export const aittsVoicesValidator = v.union(
  ...AVAILABLE_AITTS_VOICES.map((voice) => v.literal(voice)),
);
export type AITTSVoice = Infer<typeof aittsVoicesValidator>;

export const IMAGE_VERSION_SOURCES = [
  "ai_generated",
  "user_uploaded",
  "ai_edited",
] as const;
export const imageVersionSourceValidator = v.union(
  ...IMAGE_VERSION_SOURCES.map((s) => v.literal(s)),
);
export type ImageVersionSource = Infer<typeof imageVersionSourceValidator>;

export const TRANSITION_TYPES = ["cut", "fade", "dissolve", "wipe"] as const;
export const transitionTypeValidator = v.union(
  ...TRANSITION_TYPES.map((t) => v.literal(t)),
);

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

export const priceIdValidator = v.union(
  v.literal("small"),
  v.literal("medium"),
  v.literal("large"),
);
export type PriceId = Infer<typeof priceIdValidator>;

const priceValidator = v.object({
  stripeId: v.string(),
  amount: v.number(),
});
const pricesValidator = v.object({
  [CURRENCIES.USD]: priceValidator,
  [CURRENCIES.EUR]: priceValidator,
});

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
  story: defineTable({
    updatedAt: v.number(),
    userId: v.id("users"),
    title: v.string(),
    script: v.string(),
    status: v.optional(storyStatusValidator),
    generationStatus: v.optional(storyGenerationStatusValidator),
    format: v.optional(storyFormatValidator),
    context: v.optional(v.string()),
    generationId: v.optional(v.string()),
  })
    .index("userId", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .searchIndex("search_story", { searchField: "script" }),
  segments: defineTable({
    storyId: v.id("story"),
    text: v.string(),
    order: v.number(),
    isGenerating: v.boolean(),
    selectedVersionId: v.optional(v.id("imageVersions")),
    error: v.optional(v.string()),
    isAnalyzingText: v.optional(v.boolean()),
    structuredText: v.optional(
      v.array(
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
    ),
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
  transitions: defineTable({
    storyId: v.id("story"),
    afterSegmentId: v.id("segments"),
    type: transitionTypeValidator,
    duration: v.number(),
  })
    .index("by_story", ["storyId"])
    .index("by_afterSegment", ["afterSegmentId"]),
  userMessages: defineTable({
    userId: v.id("users"),
    prompt: v.string(),
    responseStreamId: StreamIdValidator,
  })
    .index("by_user", ["userId"])
    .index("by_stream", ["responseStreamId"]),
});

export default schema;
