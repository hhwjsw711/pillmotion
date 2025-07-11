import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v, Infer } from "convex/values";
import { agentsSchemaValidator } from "./agents/schema";
import { conversationParticipantsTable } from "./conversationParticipants/schema";
import { conversationMessagesTable } from "./conversationMessages/schema";
import { vEntryId } from "@convex-dev/rag";

// Extracted validator for an image object with url and storageId
const imageObject = v.object({
  url: v.string(),
  storageId: v.id("_storage"),
});

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
  files: defineTable({
    name: v.string(),
    size: v.number(),
    type: v.string(),
    position: v.object({
      x: v.number(),
      y: v.number(),
    }),
    uploadState: v.union(
      v.object({
        kind: v.literal("created"),
      }),
      v.object({
        kind: v.literal("uploading"),
        progress: v.number(),
        lastProgressAt: v.number(),
        timeoutJobId: v.id("_scheduled_functions"),
      }),
      v.object({
        kind: v.literal("uploaded"),
        storageId: v.id("_storage"),
        url: v.string(),
      }),
      v.object({
        kind: v.literal("errored"),
        message: v.string(),
      }),
    ),
  }),
  images: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.object({
        kind: v.literal("uploading"),
      }),
      v.object({
        kind: v.literal("uploaded"),
        image: imageObject,
      }),
      v.object({
        kind: v.literal("generating"),
        image: imageObject,
        prompt: v.string(),
      }),
      v.object({
        kind: v.literal("generated"),
        image: imageObject,
        decoratedImage: imageObject,
        prompt: v.string(),
      }),
    ),
  }).index("by_user", ["userId"]),
  videos: defineTable({
    url: v.string(), // Original YouTube URL
    videoId: v.string(), // Extracted YouTube video ID
    title: v.string(), // Video title from oEmbed
    thumbnailKey: v.optional(v.string()), // R2 object key for the generated thumbnail
    originalThumbnailUrl: v.string(), // Original YouTube thumbnail URL
    processedThumbnailUrl: v.string(), // Processed thumbnail URL
    createdAt: v.number(), // Timestamp
    // Thumbnail monitoring fields
    scheduledFunctionId: v.optional(v.id("_scheduled_functions")), // ID of scheduled thumbnail check
    lastThumbnailHash: v.optional(v.string()), // Hash of the last downloaded thumbnail
    checkIntervalDays: v.optional(v.number()), // Current check interval in days (1, 2, 4, 8, 16)
    lastCheckedAt: v.optional(v.number()), // Timestamp of last thumbnail check
  }).index("by_videoId", ["videoId"]),
  story: defineTable({
    title: v.string(),
    userId: v.id("users"),
    script: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("processing"),
      v.literal("completed"),
    ),
    isVertical: v.optional(v.boolean()),
    context: v.optional(v.string()),
    error: v.optional(v.string()),
  }).index("userId", ["userId"]),
  credits: defineTable({
    userId: v.id("users"),
    remaining: v.number(),
  }).index("userId", ["userId"]),
  segments: defineTable({
    storyId: v.id("story"),
    text: v.string(),
    order: v.number(),
    isGenerating: v.boolean(),
    prompt: v.optional(v.string()),
    error: v.optional(v.string()),
    image: v.optional(v.id("_storage")),
    previewImage: v.optional(v.id("_storage")),
  }).index("storyId", ["storyId"]),
  conversations: defineTable({
    title: v.string(),
    createdBy: v.id("users"),
    lastMessageTime: v.number(),
  }).index("by_user_and_time", ["createdBy", "lastMessageTime"]),
  agents: defineTable(agentsSchemaValidator)
    .index("by_creator", ["createdBy"])
    .index("by_name", ["name"])
    .index("by_system_agent_kind", ["systemAgentKind"]),
  conversationParticipants: conversationParticipantsTable,
  conversationMessages: conversationMessagesTable,
  phrases: defineTable({
    text: v.string(),
    embedding: v.array(v.number()),
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536, // OpenAI's text-embedding-3-small model dimensions
  }),
  fileMetadata: defineTable({
    entryId: vEntryId,
    filename: v.string(),
    storageId: v.id("_storage"),
    global: v.boolean(),
    category: v.optional(v.string()),
    uploadedBy: v.string(),
  })
    .index("global_category", ["global", "category"])
    .index("entryId", ["entryId"]),
});

export default schema;
