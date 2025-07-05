import { internalQuery } from "../_generated/server";
import { systemAgentKindValidator } from "./schema";
import * as Agents from "./model";
import { v } from "convex/values";

export const findSystemAgentByKind = internalQuery({
  args: {
    systemAgentKind: systemAgentKindValidator,
  },
  handler: async (ctx, args) => {
    return await Agents.findSystemAgentByKind(ctx.db, args);
  },
});

export const listAgentsForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await Agents.listForUser(ctx.db, { userId: args.userId });
  },
});

export const find = internalQuery({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    return await Agents.find(ctx.db, args);
  },
});
