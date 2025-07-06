import { getAuthUserId } from "@convex-dev/auth/server";
import { DatabaseReader, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export const find = async (
  db: DatabaseReader,
  { userId }: { userId: Id<"users"> },
) => {
  return await db.get(userId);
};

export const get = async (
  db: DatabaseReader,
  { userId }: { userId: Id<"users"> },
) => {
  const user = await find(db, { userId });
  if (!user) throw new Error(`User not found ${userId}`);
  return user;
};

export const getMyId = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
};

export const getMe = async (ctx: QueryCtx) => {
  const userId = await getMyId(ctx);
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  return user;
};
