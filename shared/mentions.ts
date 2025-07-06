import { Id } from "../convex/_generated/dataModel";
import { MessageReference } from "./misc";

export type MessagePart =
  | { type: "text"; content: string }
  | { type: "mention"; content: string; reference: MessageReference };

// Shared regex pattern for mention format: @[name](kind:id)
const MENTION_REGEX = /@\[([^\]]+)\]\(([^:]+):([^)]+)\)/g;

/**
 * Creates a mention string for a user or agent.
 *
 * @param reference - The reference object containing user or agent details
 * @returns A string in the format "@[name](kind:id)"
 */
export const createMentionString = (
  reference:
    | { kind: "user"; userId: Id<"users">; name: string }
    | { kind: "agent"; agentId: Id<"agents">; name: string },
): string => {
  if (reference.kind === "agent") {
    return `@[${reference.name}](agent:${reference.agentId})`;
  } else {
    return `@[${reference.name}](user:${reference.userId})`;
  }
};

/**
 * Splits message content into an array of text and mention parts.
 * Text parts contain regular text content, while mention parts contain the reference data.
 *
 * @param content - The message content to split
 * @returns Array of message parts (text or mention)
 */
export const splitMessageContent = (content: string): MessagePart[] => {
  const mentions = parseMentionsFromMessageContent(content);
  const parts: MessagePart[] = [];
  let lastIndex = 0;
  let mentionIndex = 0;

  let match;
  // Reset the regex to start from the beginning
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
    }

    parts.push({
      type: "mention",
      content: match[0],
      reference: mentions[mentionIndex++],
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: "text",
      content: content.slice(lastIndex),
    });
  }

  return parts;
};

/**
 * Parses message content to extract references to entities like users or agents.
 *
 * References are formatted as: @[name](kind:id)
 * Example: "Hello @[Mike](agent:abc1234)" references an agent with ID abc1234
 * Example: "Hello @[John](user:xyz789)" references a user with ID xyz789
 *
 * @param content - The message content to parse
 * @returns Array of references found in the message content
 */
export const parseMentionsFromMessageContent = (
  content: string,
): MessageReference[] => {
  const references: MessageReference[] = [];

  let match;
  // Reset the regex to start from the beginning
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const [_, name, kind, id] = match;

    if (kind === "agent") {
      references.push({
        kind: "agent",
        agentId: id as Id<"agents">,
        display: name,
      });
    } else if (kind === "user") {
      references.push({
        kind: "user",
        userId: id as Id<"users">,
        display: name,
      });
    }
  }

  return references;
};
