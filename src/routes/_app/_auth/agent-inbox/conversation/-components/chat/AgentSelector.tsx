import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Doc, Id } from "~/convex/_generated/dataModel";
import { Avatar, AvatarImage, AvatarFallback } from "@/ui/avatar";
import { Button } from "@/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { UserPlus, Loader2 } from "lucide-react";
import { useApiErrorHandler } from "@/hooks/useApiErrorHandler";

interface AgentSelectorProps {
  conversation: Doc<"conversations">;
  trigger?: React.ReactNode;
}

export const AgentSelector: React.FC<AgentSelectorProps> = ({
  conversation,
  trigger,
}) => {
  const queryClient = useQueryClient();
  const onApiError = useApiErrorHandler();

  const agentsQuery = convexQuery(api.agents.queries.listMine, {});
  const { data: agents } = useQuery(agentsQuery);

  const participantsQuery = convexQuery(
    api.conversationParticipants.queries.listDetailsForMe,
    {
      conversationId: conversation._id,
    },
  );
  const { data: participants } = useQuery(participantsQuery);

  const addAgent = useMutation({
    mutationFn: useConvexMutation(
      api.conversationParticipants.mutations.addAgent,
    ),
    onSuccess: () => {
      // When an agent is added, invalidate the participants query to refetch
      queryClient.invalidateQueries({ queryKey: participantsQuery.queryKey });
    },
    onError: onApiError,
  });

  const handleAddAgent = (agentId: Id<"agents">) => {
    addAgent.mutate({
      conversationId: conversation._id,
      agentId,
    });
  };

  // Filter out agents that are already in the conversation
  const availableAgents = agents?.filter(
    (agent) =>
      !participants?.some((p) => p.kind === "agent" && p.name === agent.name),
  );

  if (!availableAgents?.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <Button className="w-full" variant="outline">
            <UserPlus className="mr-2 h-4 w-4" />
            Add Agent
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[240px]">
        {availableAgents.map((agent) => (
          <DropdownMenuItem
            key={agent._id}
            onClick={() => handleAddAgent(agent._id)}
            disabled={addAgent.isPending}
            className="flex items-center gap-2 p-2"
          >
            {addAgent.variables?.agentId === agent._id ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Avatar className="h-6 w-6">
                <AvatarImage src={agent.avatarUrl} />
                <AvatarFallback>{agent.name[0]}</AvatarFallback>
              </Avatar>
            )}
            <div className="flex flex-col">
              <div className="text-sm font-medium">{agent.name}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">
                {agent.description}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
