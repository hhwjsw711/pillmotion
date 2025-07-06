import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Doc, Id } from "~/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog";
import { UserPlus, Trash2, Loader2 } from "lucide-react";
import { AgentSelector } from "./AgentSelector";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip";
import { Skeleton } from "@/ui/skeleton";

interface ParticipantsDialogProps {
  conversation: Doc<"conversations">;
  trigger: React.ReactNode;
}

export const ParticipantsDialog: React.FC<ParticipantsDialogProps> = ({
  conversation,
  trigger,
}) => {
  const queryClient = useQueryClient();
  const { data: participants, isLoading } = useQuery(
    convexQuery(api.conversationParticipants.queries.listDetailsForMe, {
      conversationId: conversation._id,
    }),
  );

  const removeParticipant = useMutation({
    mutationFn: useConvexMutation(
      api.conversationParticipants.mutations.removeParticipant,
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "convex",
          "conversationParticipants/queries:listDetailsForMe",
        ],
      });
      queryClient.invalidateQueries({
        queryKey: ["convex", "conversationParticipants/queries:listAvatars"],
      });
    },
  });

  const handleRemove = (participantId: Id<"conversationParticipants">) => {
    removeParticipant.mutate({
      conversationId: conversation._id,
      participantId,
    });
  };

  // Group participants by type
  const users = participants?.filter((p) => p.kind === "user") ?? [];
  const agents = participants?.filter((p) => p.kind === "agent") ?? [];

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conversation Participants</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-6 pt-2">
            <div className="space-y-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-12 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Users section */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                Users
              </div>
              {users.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={p.avatarUrl} />
                      <AvatarFallback>{p.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{p.name}</div>
                      {p.isCreator && (
                        <div className="text-xs text-muted-foreground">
                          Creator
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Agents section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">
                  Agents
                </div>
                <AgentSelector
                  conversation={conversation}
                  trigger={
                    <Button variant="ghost" size="sm" className="h-7">
                      <UserPlus className="h-4 w-4 mr-1.5" />
                      Add
                    </Button>
                  }
                />
              </div>
              {agents.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={p.avatarUrl} />
                      <AvatarFallback>{p.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {p.description}
                      </div>
                    </div>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemove(p.id)}
                            disabled={
                              p.isSystem ||
                              (removeParticipant.isPending &&
                                removeParticipant.variables?.participantId ===
                                  p.id)
                            }
                          >
                            {removeParticipant.isPending &&
                            removeParticipant.variables?.participantId ===
                              p.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {p.isSystem && (
                        <TooltipContent>
                          <p>
                            System agents cannot be removed from a conversation
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ))}
              {agents.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4 bg-muted/50 rounded-lg">
                  No agents added yet
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
