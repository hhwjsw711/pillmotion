import { query } from "../_generated/server";
import { v } from "convex/values";
import { pick } from "convex-helpers";
import { Id } from "../_generated/dataModel";
import * as Agents from "./model";

export const listMine = query({
  args: {},
  handler: async (ctx) => Agents.listMine(ctx),
});

export const getMine = query({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => Agents.getMine(ctx, args),
});

export const findMine = query({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => Agents.findMine(ctx, args),
});

export const findMention = query({
  args: {
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const agent = await ctx.db.get(args.agentId as Id<"agents">);
      if (!agent) return null;
      return pick(agent, ["name", "_id", "avatarUrl"]);
    } catch (error) {
      // Return null if ID is invalid or any other error occurs
      return null;
    }
  },
});
