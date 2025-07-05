import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import { Sidebar } from "./-components/sidebar/Sidebar";
import { z } from "zod";

const agentInboxSearchSchema = z.object({
  tab: z.enum(["conversations", "agents"]).default("conversations"),
});

export const Route = createFileRoute("/_app/_auth/agent-inbox/_layout")({
  component: AgentInboxLayout,
  validateSearch: agentInboxSearchSchema,
});

function AgentInboxLayout() {
  const { data: user } = useQuery(convexQuery(api.app.getCurrentUser, {}));
  const { tab } = Route.useSearch();

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <div className="w-64 bg-card border-r border-border flex-shrink-0">
        <Sidebar user={user} activeTab={tab} />
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
