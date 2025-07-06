import { createFileRoute } from "@tanstack/react-router";
import { Id } from "~/convex/_generated/dataModel";
import { AgentProfile } from "./-components/agents/AgentProfile";

export const Route = createFileRoute("/_app/_auth/agent-inbox/agent/$agentId")({
  component: AgentProfilePage,
  parseParams: (params) => ({
    agentId: params.agentId as Id<"agents">,
  }),
  stringifyParams: (params) => ({ agentId: params.agentId }),
});

function AgentProfilePage() {
  const { agentId } = Route.useParams();
  return <AgentProfile agentId={agentId} />;
}
