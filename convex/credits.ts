import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internalMutation, MutationCtx } from "./_generated/server";

export const consumeCredits = internalMutation({
  args: {
    userId: v.id("users"),
    amountToUse: v.number(),
  },
  handler: async (ctx, args) => {
    await consumeCreditsHelper(ctx, args.userId, args.amountToUse);
  },
});

export async function consumeCreditsHelper(
  ctx: MutationCtx,
  userId: Id<"users">,
  amountToUse: number,
) {
  const credits = await ctx.db
    .query("credits")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .first();

  if (!credits) {
    throw new ConvexError("No credits found");
  }

  if (credits.remaining < amountToUse) {
    throw new ConvexError("Insufficient credits");
  }

  await ctx.db.patch(credits._id, {
    remaining: credits.remaining - amountToUse,
  });
}
