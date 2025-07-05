import { createFileRoute } from "@tanstack/react-router";
import { Id } from "@cvx/_generated/dataModel";
import { AgentProfile } from "./-components/agents/AgentProfile";

export const Route = createFileRoute("/_app/_auth/agent-inbox/agent/$agentId")({
  component: AgentProfilePage,
});

function AgentProfilePage() {
  const { agentId } = Route.useParams();
  return <AgentProfile agentId={agentId as Id<"agents">} />;
}
