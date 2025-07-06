import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Plus, Loader2 } from "lucide-react";
import { useApiErrorHandler } from "@/hooks/useApiErrorHandler";
import { Button } from "@/ui/button";
import { Route as ConversationRoute } from "@/routes/_app/_auth/agent-inbox/conversation/$conversationId";

const DEFAULT_THREAD_TITLE = "New Conversation";

export const ConversationList = () => {
  const navigate = useNavigate();
  const onApiError = useApiErrorHandler();
  const queryClient = useQueryClient();

  const conversationsQuery = convexQuery(
    api.conversations.queries.listMine,
    {},
  );
  const { data: conversations } = useQuery(conversationsQuery);

  const createConversation = useMutation({
    mutationFn: useConvexMutation(api.conversations.mutations.create),
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: conversationsQuery.queryKey });
      navigate({
        to: ConversationRoute.to,
        params: { conversationId: conversationId as Id<"conversations"> },
        search: true,
      });
    },
    onError: onApiError,
  });

  const handleCreateConversation = () => {
    createConversation.mutate({ title: DEFAULT_THREAD_TITLE });
  };

  return (
    <>
      <div className="p-4">
        <Button
          className="w-full"
          variant="default"
          onClick={handleCreateConversation}
          disabled={createConversation.isPending}
        >
          {createConversation.isPending ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <Plus className="h-5 w-5 mr-2" />
          )}
          New Conversation
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations?.map((conversation) => (
          <Link
            key={conversation._id}
            to={ConversationRoute.to}
            params={{ conversationId: conversation._id }}
            search={true}
            className="block p-4 cursor-pointer hover:bg-accent"
            activeProps={{ className: "bg-accent" }}
          >
            <div className="font-medium text-foreground truncate">
              {conversation.title}
            </div>
            <div className="text-sm text-muted-foreground/80 truncate">
              {new Date(conversation._creationTime).toLocaleTimeString()}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
};
