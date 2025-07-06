import { v } from "convex/values";
import { defineTable } from "convex/server";

export const conversationParticipantStatusSchemaValidator = v.union(
  v.literal("inactive"),
  v.literal("thinking"),
);

const common = {
  conversationId: v.id("conversations"),
  addedAt: v.number(),
  status: conversationParticipantStatusSchemaValidator,
  isRemoved: v.boolean(),
};

export const conversationParticipantIdentifierSchemaValidator = v.union(
  v.object({
    kind: v.literal("agent"),
    agentId: v.id("agents"),
  }),
  v.object({
    kind: v.literal("user"),
    userId: v.id("users"),
  }),
);

export const conversationParticipantsSchemaValidator = v.union(
  v.object({
    kind: v.literal("agent"),
    agentId: v.id("agents"),
    ...common,
  }),
  v.object({
    kind: v.literal("user"),
    userId: v.id("users"),
    ...common,
  }),
);

export const conversationParticipantsTable = defineTable(
  conversationParticipantsSchemaValidator,
)
  .index("by_conversationId", ["conversationId"])
  .index("by_conversationId_isRemoved", ["conversationId", "isRemoved"])
  .index("by_userId", ["userId"])
  .index("by_conversationId_kind_agentId", [
    "conversationId",
    "kind",
    "agentId",
  ])
  .index("by_conversationId_kind_userId", ["conversationId", "kind", "userId"])
  .index("by_conversationId_status", ["conversationId", "status"]);
