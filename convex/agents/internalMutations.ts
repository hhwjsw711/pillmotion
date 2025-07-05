import { internalMutation } from "../_generated/server";
import { systemAgentValidator } from "./schema";
import * as Agents from "./model";

export const createSystemAgent = internalMutation({
  args: systemAgentValidator,
  handler: async (ctx, args) => {
    const existringAgent = await Agents.findSystemAgentByKind(ctx.db, {
      systemAgentKind: args.systemAgentKind,
    });
    if (existringAgent) return existringAgent;
    await Agents.createSystemAgent(ctx, args);
    return Agents.getSystemAgentByKind(ctx.db, {
      systemAgentKind: args.systemAgentKind,
    });
  },
});
