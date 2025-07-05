import { Button } from "@/ui/button";
import { Plus } from "lucide-react";
import { api } from "~/convex/_generated/api";
import { useApiErrorHandler } from "@/hooks/useApiErrorHandler";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { AgentAvatar } from "@/ui/agent-avatar";
import { Link, useNavigate } from "@tanstack/react-router";
import { Id } from "@cvx/_generated/dataModel";
import { Route as AgentRoute } from "@/routes/_app/_auth/agent-inbox/agent/$agentId";

export const AgentList = () => {
  const agentListQuery = convexQuery(api.agents.queries.listMine, {});
  const { data: agents } = useQuery(agentListQuery);

  const onApiError = useApiErrorHandler();
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const createAgent = useMutation({
    mutationFn: useConvexMutation(api.agents.mutations.create),
    onSuccess: (agentId) => {
      queryClient.invalidateQueries({ queryKey: agentListQuery.queryKey });
      navigate({
        to: AgentRoute.to,
        params: { agentId: agentId as Id<"agents"> },
      });
    },
    onError: onApiError,
  });

  const handleCreateAgent = () => {
    createAgent.mutate({});
  };

  return (
    <>
      <div className="p-4">
        <Button
          className="w-full"
          variant="default"
          onClick={handleCreateAgent}
          disabled={createAgent.isPending}
        >
          {createAgent.isPending ? (
            "Creating..."
          ) : (
            <>
              <Plus className="h-5 w-5 mr-2" />
              New Agent
            </>
          )}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {agents?.map((agent) => (
          <Link
            key={agent._id}
            to={AgentRoute.to}
            params={{ agentId: agent._id }}
            className="p-4 hover:bg-accent flex items-center gap-3"
            activeProps={{ className: "bg-accent" }}
          >
            <AgentAvatar
              size="sm"
              avatarUrl={agent.avatarUrl}
              name={agent.name}
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground truncate">
                {agent.name}
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {agent.description}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
};
