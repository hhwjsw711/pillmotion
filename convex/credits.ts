import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { ERRORS } from "~/errors";
import { MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { CREDIT_COSTS, creditCostValidator } from "./schema";

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

export async function consumeCreditsHelper(
  ctx: MutationCtx,
  userId: Id<"users">,
  amountToUse: number,
) {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError(`User not found with ID: ${userId}`);
  }

  if ((user.credits ?? 0) < amountToUse) {
    throw new ConvexError(
      `Insufficient credits for user ${userId}. Required: ${amountToUse}, Available: ${user.credits ?? 0}`,
    );
  }

  await ctx.db.patch(userId, {
    credits: (user.credits ?? 0) - amountToUse,
  });
}

export const consumeCredits = internalMutation({
  args: {
    userId: v.id("users"),
    cost: creditCostValidator,
  },
  handler: async (ctx, args) => {
    await consumeCreditsHelper(ctx, args.userId, args.cost);
  },
});

export const refundTrainingCredits = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError(`User not found with ID: ${args.userId}`);
    }
    await ctx.db.patch(args.userId, {
      credits: (user.credits ?? 0) + CREDIT_COSTS.LORA_TRAINING,
    });
  },
});
