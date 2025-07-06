import { DatabaseReader, MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import * as Users from "../users/model";
import { predefinedAgents } from "../../shared/predefinedAgents";
import { systemAgentKindValidator, systemAgentValidator } from "./schema";

export const find = async (
  db: DatabaseReader,
  { agentId }: { agentId: Id<"agents"> },
) => {
  return await db.get(agentId);
};

export const get = async (
  db: DatabaseReader,
  { agentId }: { agentId: Id<"agents"> },
) => {
  const agent = await find(db, { agentId });
  if (!agent) throw new Error(`Agent not found ${agentId}`);
  return agent;
};

export const createAgentAvatarUrl = (seed: string) => {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
};

export const createAgent = async (ctx: MutationCtx) => {
  const userId = await Users.getMyId(ctx);
  const randomIndex = Math.floor(Math.random() * predefinedAgents.length);
  const selectedAgent = predefinedAgents[randomIndex];

  return await ctx.db.insert("agents", {
    name: selectedAgent.name,
    description: selectedAgent.description,
    personality: selectedAgent.personality,
    tools: selectedAgent.tools,
    createdBy: userId,
    lastActiveTime: Date.now(),
    avatarUrl: createAgentAvatarUrl(selectedAgent.name),
    kind: "user_agent",
  });
};

export const createSystemAgent = async (
  ctx: MutationCtx,
  args: typeof systemAgentValidator.type,
) => {
  return await ctx.db.insert("agents", {
    ...args,
    kind: "system_agent",
  });
};

export const listForUser = async (
  db: DatabaseReader,
  { userId }: { userId: Id<"users"> },
) => {
  return await db
    .query("agents")
    .withIndex("by_creator", (q) => q.eq("createdBy", userId))
    .collect();
};

export const listMine = async (ctx: QueryCtx) => {
  const userId = await Users.getMyId(ctx);
  return listForUser(ctx.db, { userId });
};

export const findMine = async (
  ctx: QueryCtx,
  { agentId }: { agentId: Id<"agents"> },
) => {
  const userId = await Users.getMyId(ctx);
  const agent = await ctx.db.get(agentId);
  if (!agent) throw new Error("Access denied");
  if (agent.kind != "user_agent") throw new Error("Access denied");
  if (agent.createdBy != userId) throw new Error("Access denied");
  return agent;
};

export const getMine = async (
  ctx: QueryCtx,
  { agentId }: { agentId: Id<"agents"> },
) => {
  const agent = await findMine(ctx, { agentId });
  if (!agent) throw new Error("Agent not found");
  return agent;
};

export const ensureICanAccessAgent = async (
  ctx: QueryCtx,
  { agentId }: { agentId: Id<"agents"> },
) => {
  const agent = await getMine(ctx, { agentId });
  if (!agent) throw new Error("Access denied");
};

export const updateMine = async (
  ctx: MutationCtx,
  {
    agentId,
    name,
    description,
    personality,
    tools,
  }: {
    agentId: Id<"agents">;
    name: string;
    description: string;
    personality: string;
    tools: string[];
  },
) => {
  return await ctx.db.patch(agentId, {
    name,
    description,
    personality,
    tools,
  });
};

export const remove = async (
  ctx: MutationCtx,
  { agentId }: { agentId: Id<"agents"> },
) => {
  await ctx.db.delete(agentId);
};

export const findSystemAgentByKind = async (
  db: DatabaseReader,
  {
    systemAgentKind,
  }: { systemAgentKind: typeof systemAgentKindValidator.type },
) => {
  const agent = await db
    .query("agents")
    .withIndex("by_system_agent_kind", (q) =>
      q.eq("systemAgentKind", systemAgentKind),
    )
    .first();
  return agent;
};

export const getSystemAgentByKind = async (
  db: DatabaseReader,
  {
    systemAgentKind,
  }: { systemAgentKind: typeof systemAgentKindValidator.type },
) => {
  const agent = await findSystemAgentByKind(db, { systemAgentKind });
  if (!agent) throw new Error(`System agent '${systemAgentKind}' not found`);
  return agent;
};

export const getTriageAgent = async (db: DatabaseReader) => {
  return await getSystemAgentByKind(db, { systemAgentKind: "triage" });
};
