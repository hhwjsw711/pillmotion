import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { useApiErrorHandler } from "@/hooks/useApiErrorHandler";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { Confirm } from "@/ui/confirm";
import { AgentAvatar } from "@/ui/agent-avatar";
import { AgentDescription } from "./AgentDescription";
import { AgentPersonality } from "./AgentPersonality";
import { AgentTools } from "./AgentTools";
import { Loader2, Shuffle, Pencil, Check } from "lucide-react";
import { Input } from "@/ui/input";
import { Route as AgentInboxIndexRoute } from "@/routes/_app/_auth/agent-inbox/index";

export const AgentProfile = ({ agentId }: { agentId: Id<"agents"> }) => {
  const navigate = useNavigate();
  const onApiError = useApiErrorHandler();
  const queryClient = useQueryClient();

  const agentQuery = convexQuery(api.agents.queries.findMine, { agentId });
  const { data: agent, isLoading } = useQuery(agentQuery);

  const agentListQuery = convexQuery(api.agents.queries.listMine, {});

  const updateAgent = useMutation({
    mutationFn: useConvexMutation(api.agents.mutations.updateMine),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentQuery.queryKey });
    },
    onError: onApiError,
    onSettled: () => {
      setIsEditingName(false);
    },
  });

  const shuffleAvatar = useMutation({
    mutationFn: useConvexMutation(api.agents.mutations.shuffleAvatar),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentQuery.queryKey });
    },
    onError: onApiError,
  });

  const deleteAgent = useMutation({
    mutationFn: useConvexMutation(api.agents.mutations.removeMine),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentListQuery.queryKey });
      navigate({
        to: AgentInboxIndexRoute.to,
        search: { tab: "agents" },
      });
    },
    onError: onApiError,
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [editedName, setEditedName] = React.useState("");

  React.useEffect(() => {
    if (agent?.name) setEditedName(agent.name);
  }, [agent?.name]);

  const handleNameSubmit = () => {
    if (!editedName.trim() || !agent || editedName === agent.name) {
      setIsEditingName(false);
      return;
    }
    updateAgent.mutate({
      agentId,
      name: editedName,
      description: agent.description,
      personality: agent.personality,
      tools: agent.tools,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNameSubmit();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
      setEditedName(agent?.name ?? "");
    }
  };

  if (isLoading)
    return (
      <div className="flex-1 p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-48 w-48 rounded-full mx-auto" />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );

  if (!agent) return <div>Agent not found.</div>;

  return (
    <div className="flex-1 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <div className="relative inline-block">
            <AgentAvatar
              avatarUrl={agent.avatarUrl}
              name={agent.name}
              size="lg"
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute bottom-6 -right-2"
              disabled={shuffleAvatar.isPending}
              onClick={() => shuffleAvatar.mutate({ agentId })}
            >
              {shuffleAvatar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shuffle className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="text-2xl font-bold text-center w-64"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNameSubmit}
                  disabled={updateAgent.isPending}
                >
                  {updateAgent.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold">{agent.name}</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditingName(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        <AgentDescription agent={agent} updateAgent={updateAgent} />
        <div className="grid grid-cols-2 gap-6">
          <AgentPersonality agent={agent} updateAgent={updateAgent} />
          <AgentTools agent={agent} updateAgent={updateAgent} />
        </div>
        <div className="text-sm text-muted-foreground text-center">
          Last active: {new Date(agent.lastActiveTime).toLocaleString()}
        </div>
        <div className="flex justify-center">
          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete Agent
          </Button>
        </div>

        <Confirm
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="Delete Agent"
          description={`Are you sure you want to delete ${agent.name}? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => deleteAgent.mutate({ agentId: agent._id })}
          isConfirming={deleteAgent.isPending}
          variant="destructive"
        />
      </div>
    </div>
  );
};
