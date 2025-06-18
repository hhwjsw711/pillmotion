import { defineSchema, defineTable } from "convex/server";
import { StreamIdValidator } from "@convex-dev/persistent-text-streaming";
import { authTables } from "@convex-dev/auth/server";
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

export const storyFormatValidator = v.union(
  v.literal("vertical"),
  v.literal("horizontal"),
);
export type StoryFormat = Infer<typeof storyFormatValidator>;

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
    format: v.optional(storyFormatValidator),
  })
    .index("userId", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .searchIndex("search_story", { searchField: "script" }),
});

export default schema;
