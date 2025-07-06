import { Id } from "../convex/_generated/dataModel";

export function pick<T, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
  const ret: any = {};
  keys.forEach((key) => {
    ret[key] = obj[key];
  });
  return ret;
}

export function exhaustiveCheck(param: never): never {
  throw new Error(`Exhaustive check failed: ${param}`);
}

export function wait(ms: number) {
  return new Promise((resolve, _reject) => setTimeout(resolve, ms));
}

export const iife = <T>(fn: () => T): T => fn();

export type MessageReference =
  | { kind: "agent"; agentId: Id<"agents">; display: string }
  | { kind: "user"; userId: Id<"users">; display: string };

export type AgentTool = {
  name: string;
  description: string;
  parameters: Record<
    string,
    {
      type: string;
      description: string;
      required?: boolean;
    }
  >;
};
