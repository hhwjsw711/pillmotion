import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { ERRORS } from "~/errors";

export const addCredits = internalMutation({
  args: {
    customerId: v.string(),
    credits: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("customerId", (q) => q.eq("customerId", args.customerId))
      .unique();

    if (!user) {
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }

    await ctx.db.patch(user._id, {
      credits: (user.credits ?? 0) + args.credits,
    });
  },
});
