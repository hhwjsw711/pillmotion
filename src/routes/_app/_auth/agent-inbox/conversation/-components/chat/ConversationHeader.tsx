import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "~/convex/_generated/api";
import { Doc, Id } from "~/convex/_generated/dataModel";
import { Skeleton } from "@/ui/skeleton";
import { Wrench, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Confirm } from "@/ui/confirm";
import { ConversationParticipants } from "./ConversationParticipants";

interface ConversationHeaderProps {
  conversation: Doc<"conversations"> | undefined | null;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  conversation,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const updateConversation = useMutation({
    mutationFn: useConvexMutation(api.conversations.mutations.updateMine),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["convex", "conversations/queries:findMine"],
      });
      queryClient.invalidateQueries({
        queryKey: ["convex", "conversations/queries:listMine"],
      });
      setIsOpen(false);
    },
  });

  const deleteConversation = useMutation({
    mutationFn: useConvexMutation(api.conversations.mutations.removeMine),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["convex", "conversations/queries:listMine"],
      });
      setIsDeleteConfirmOpen(false);
      setIsOpen(false);
      navigate({ to: "/agent-inbox" });
    },
  });

  const [isOpen, setIsOpen] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState(conversation?.title ?? "");

  React.useEffect(() => {
    if (conversation?.title) setNewTitle(conversation.title);
  }, [conversation?.title]);

  const handleSave = () => {
    if (!conversation?._id || !newTitle.trim()) return;

    updateConversation.mutate({
      conversationId: conversation._id as Id<"conversations">,
      title: newTitle.trim(),
    });
  };

  const handleDelete = () => {
    if (!conversation?._id) return;

    deleteConversation.mutate({
      conversationId: conversation._id as Id<"conversations">,
    });
  };

  return (
    <div className="h-14  flex items-center px-4 ">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="font-medium text-lg gap-2 bg-background"
          >
            {conversation?._id && !conversation ? (
              <Skeleton className="h-7 w-48" />
            ) : (
              <>
                {conversation?.title}
                <Wrench className="h-4 w-4 opacity-20" />
              </>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conversation Settings</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Conversation Name
            </label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter conversation name"
            />
          </div>
          <DialogFooter className="flex justify-between items-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete Conversation
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateConversation.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Confirm
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title="Delete Conversation"
        description={`Are you sure you want to delete "${conversation?.title}"? This action cannot be undone.`}
        confirmText="Delete Conversation"
        variant="destructive"
        onConfirm={handleDelete}
        isConfirming={deleteConversation.isPending}
      />

      <ConversationParticipants conversation={conversation} />
    </div>
  );
};
