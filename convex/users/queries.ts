import { v } from "convex/values";
import { query } from "../_generated/server";
import * as Users from "./model";
import { pick } from "convex-helpers";
import { Id } from "../_generated/dataModel";

export const getMe = query({
  args: {},
  handler: async (ctx) => Users.getMe(ctx),
});

export const findMention = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const user = await ctx.db.get(args.userId as Id<"users">);
      if (!user) return null;
      return pick(user, ["name", "_id", "image"]);
    } catch (error) {
      // Return null if ID is invalid or any other error occurs
      return null;
    }
  },
});
