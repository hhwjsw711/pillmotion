import { defineTable } from "convex/server";
import { v } from "convex/values";

export const conversationMessageReferenceSchemaValidator = v.union(
  v.object({
    kind: v.literal("agent"),
    agentId: v.id("agents"),
  }),
  v.object({
    kind: v.literal("user"),
    userId: v.id("users"),
  }),
);

export const conversationMessageReferencesSchemaValidator = v.array(
  conversationMessageReferenceSchemaValidator,
);

const common = {
  conversationId: v.id("conversations"),
  content: v.string(),
};

export const conversationParticipantMessageSchemaValidator = v.object({
  ...common,
  kind: v.literal("participant"),
  authorParticipantId: v.id("conversationParticipants"),
});

export const conversationAgentMessageSchemaValidator = v.union(
  conversationParticipantMessageSchemaValidator,
  v.object({
    ...common,
    kind: v.literal("system"),
    meta: v.optional(v.any()),
  }),
);

export const conversationMessagesTable = defineTable(
  conversationAgentMessageSchemaValidator,
)
  .index("by_conversationId", ["conversationId"])
  .index("by_conversationId_kind", ["conversationId", "kind"]);
