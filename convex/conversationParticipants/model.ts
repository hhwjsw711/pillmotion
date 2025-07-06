import { DatabaseReader, DatabaseWriter, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import * as Agents from "../agents/model";
import * as Users from "../users/model";
import { exhaustiveCheck } from "../../shared/misc";
import { conversationParticipantIdentifierSchemaValidator } from "./schema";
import * as ConversationMessages from "../conversationMessages/model";

export const getNonRemovedParticipants = async (
  db: DatabaseReader,
  { conversationId }: { conversationId: Id<"conversations"> },
) => {
  const participants = await db
    .query("conversationParticipants")
    .withIndex("by_conversationId_isRemoved", (q) =>
      q.eq("conversationId", conversationId).eq("isRemoved", false),
    )
    .collect();

  return participants;
};

export const findParticipant = async (
  db: DatabaseReader,
  { participantId }: { participantId: Id<"conversationParticipants"> },
) => {
  return await db.get(participantId);
};

export const getParticipant = async (
  db: DatabaseReader,
  { participantId }: { participantId: Id<"conversationParticipants"> },
) => {
  const participant = await findParticipant(db, { participantId });
  if (!participant) throw new Error(`Participant not found ${participantId}`);
  return participant;
};

export const getParticipantUserOrAgent = async (
  db: DatabaseReader,
  { participantId }: { participantId: Id<"conversationParticipants"> },
): Promise<
  { kind: "agent"; agent: Doc<"agents"> } | { kind: "user"; user: Doc<"users"> }
> => {
  const participant = await getParticipant(db, { participantId });

  if (participant.kind === "agent")
    return {
      kind: "agent" as const,
      agent: await Agents.get(db, { agentId: participant.agentId }),
    };

  if (participant.kind === "user")
    return {
      kind: "user",
      user: await Users.get(db, { userId: participant.userId }),
    };

  exhaustiveCheck(participant);
};
export type ParticipantUserOrAgent = Awaited<
  ReturnType<typeof getParticipantUserOrAgent>
>;

export const addAgentOrReactivate = async (
  db: DatabaseWriter,
  {
    conversationId,
    agentId,
  }: { conversationId: Id<"conversations">; agentId: Id<"agents"> },
) => {
  const existing = await db
    .query("conversationParticipants")
    .withIndex("by_conversationId_kind_agentId", (q) =>
      q
        .eq("conversationId", conversationId)
        .eq("kind", "agent")
        .eq("agentId", agentId),
    )
    .first();

  if (existing) {
    if (existing.isRemoved)
      await db.patch(existing._id, {
        isRemoved: false,
      });

    return existing._id;
  }

  return db.insert("conversationParticipants", {
    conversationId,
    agentId,
    kind: "agent",
    addedAt: Date.now(),
    status: "inactive",
    isRemoved: false,
  });
};

export const addAgentAndSendJoinMessage = async (
  db: DatabaseWriter,
  {
    conversationId,
    agentId,
  }: { conversationId: Id<"conversations">; agentId: Id<"agents"> },
) => {
  const participantId = await addAgentOrReactivate(db, {
    conversationId,
    agentId,
  });
  const agent = await Agents.get(db, { agentId });
  await ConversationMessages.createParticipantJoinedConversationMessage(db, {
    conversationId,
    agentOrUser: agent,
  });
  return participantId;
};

export const addUser = async (
  db: DatabaseWriter,
  {
    conversationId,
    userId,
  }: { conversationId: Id<"conversations">; userId: Id<"users"> },
) => {
  const existing = await db
    .query("conversationParticipants")
    .withIndex("by_conversationId_kind_userId", (q) =>
      q
        .eq("conversationId", conversationId)
        .eq("kind", "user")
        .eq("userId", userId),
    )
    .first();

  if (existing) return existing._id;

  return db.insert("conversationParticipants", {
    conversationId,
    userId,
    kind: "user",
    addedAt: Date.now(),
    status: "inactive",
    isRemoved: false,
  });
};

export const removeParticipant = async (
  db: DatabaseWriter,
  { participantId }: { participantId: Id<"conversationParticipants"> },
) => {
  await db.patch(participantId, {
    isRemoved: true,
  });
};

export const findParticipantByConversationIdAndIdentifier = async (
  db: DatabaseReader,
  {
    conversationId,
    identifier,
  }: {
    conversationId: Id<"conversations">;
    identifier: typeof conversationParticipantIdentifierSchemaValidator.type;
  },
) => {
  if (identifier.kind === "agent") {
    return await db
      .query("conversationParticipants")
      .withIndex("by_conversationId_kind_agentId", (q) =>
        q
          .eq("conversationId", conversationId)
          .eq("kind", "agent")
          .eq("agentId", identifier.agentId),
      )
      .first();
  }

  if (identifier.kind === "user") {
    return await db
      .query("conversationParticipants")
      .withIndex("by_conversationId_kind_userId", (q) =>
        q
          .eq("conversationId", conversationId)
          .eq("kind", "user")
          .eq("userId", identifier.userId),
      )
      .first();
  }

  exhaustiveCheck(identifier);
};

export const getParticipantByConversationIdAndIdentifier = async (
  db: DatabaseReader,
  args: {
    conversationId: Id<"conversations">;
    identifier: typeof conversationParticipantIdentifierSchemaValidator.type;
  },
) => {
  const participant = await findParticipantByConversationIdAndIdentifier(
    db,
    args,
  );
  if (!participant) throw new Error(`Participant not found ${args.identifier}`);
  return participant;
};

export const findUserParticipantInConversation = async (
  db: DatabaseReader,
  {
    conversationId,
    userId,
  }: { conversationId: Id<"conversations">; userId: Id<"users"> },
) => {
  return await findParticipantByConversationIdAndIdentifier(db, {
    conversationId,
    identifier: { kind: "user", userId },
  });
};

export const getMyParticipant = async (
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) => {
  const userId = await Users.getMyId(ctx);
  const participant = await findParticipantByConversationIdAndIdentifier(
    ctx.db,
    {
      conversationId,
      identifier: { kind: "user", userId },
    },
  );
  if (!participant) throw new Error(`Participant not found ${userId}`);
  return participant;
};

export const doesHaveAgent = async (
  db: DatabaseReader,
  {
    conversationId,
    agentId,
  }: { conversationId: Id<"conversations">; agentId: Id<"agents"> },
) => {
  const conversationParticipant =
    await findParticipantByConversationIdAndIdentifier(db, {
      conversationId,
      identifier: { kind: "agent", agentId },
    });
  return !!conversationParticipant;
};

export const doesHaveTriageAgent = async (
  db: DatabaseReader,
  { conversationId }: { conversationId: Id<"conversations"> },
) => {
  const triageAgent = await Agents.getTriageAgent(db);
  return doesHaveAgent(db, { conversationId, agentId: triageAgent._id });
};

export const getParticipantDetails = async (
  db: DatabaseReader,
  participant: Doc<"conversationParticipants">,
  options?: {
    includeDescription?: boolean;
    isCreator?: (participant: Doc<"conversationParticipants">) => boolean;
  },
) => {
  if (participant.kind === "agent") {
    const agent = await db.get(participant.agentId);
    if (!agent) return null;
    return {
      id: participant._id,
      name: agent.name,
      avatarUrl: agent.avatarUrl,
      kind: "agent",
      ...(options?.includeDescription && { description: agent.description }),
      ...(options?.includeDescription && {
        isSystem: agent.kind === "system_agent",
      }),
      isCreator: false,
    };
  } else {
    const user = await db.get(participant.userId);
    if (!user) return null;
    return {
      id: participant._id,
      name: user.name ?? "Unknown User",
      avatarUrl:
        user.image ??
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${user._id}`,
      kind: "user",
      isCreator: options?.isCreator?.(participant) ?? false,
    };
  }
};

export const listNonSystemAgentParticipants = async (
  db: DatabaseReader,
  { conversationId }: { conversationId: Id<"conversations"> },
) => {
  const participants = await getNonRemovedParticipants(db, { conversationId });

  // Filter to only agent participants and get their details
  const agentParticipants = await Promise.all(
    participants
      .filter((p) => p.kind === "agent")
      .map(async (p) => {
        if (p.kind !== "agent") return null; // TypeScript narrowing
        const agent = await Agents.find(db, { agentId: p.agentId });
        if (!agent || agent.kind === "system_agent") return null;
        return {
          participant: p,
          agent,
        };
      }),
  );

  return agentParticipants.filter(
    (p): p is NonNullable<typeof p> => p !== null,
  );
};

export const listParticipantsWithJoinedDetails = async (
  db: DatabaseReader,
  { conversationId }: { conversationId: Id<"conversations"> },
) => {
  const participants = await getNonRemovedParticipants(db, { conversationId });

  const participantsWithDetails = await Promise.all(
    participants.map(async (participant) => {
      if (participant.kind === "agent")
        return {
          participant,
          agent: await Agents.get(db, { agentId: participant.agentId }),
        };

      if (participant.kind === "user")
        return {
          participant,
          user: await Users.get(db, { userId: participant.userId }),
        };

      exhaustiveCheck(participant);
    }),
  );

  return participantsWithDetails;
};

export const getNonSystemAgentParticipants = async (
  db: DatabaseReader,
  args: { conversationId: Id<"conversations"> },
) => {
  const participants = await listNonSystemAgentParticipants(db, args);
  if (!participants)
    throw new Error(
      `No non-system agent participants found for conversation '${args.conversationId}'`,
    );
  return participants;
};

export const deleteAllParticipantsForConversation = async (
  db: DatabaseWriter,
  { conversationId }: { conversationId: Id<"conversations"> },
) => {
  const participants = await db
    .query("conversationParticipants")
    .withIndex("by_conversationId", (q) =>
      q.eq("conversationId", conversationId),
    )
    .collect();

  await Promise.all(
    participants.map((participant) => db.delete(participant._id)),
  );
};
