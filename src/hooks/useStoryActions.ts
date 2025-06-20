import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Id, Doc } from "~/convex/_generated/dataModel";

/**
 * A custom hook to encapsulate mutations related to stories.
 * This includes deleting a story and updating its status.
 * It centralizes mutation logic, making components cleaner and the logic reusable.
 */
export function useStoryActions() {
  const { t } = useTranslation();

  // Convex mutations
  const deleteStoryMutation = useConvexMutation(api.story.deleteStory);
  const updateStatusMutation = useConvexMutation(api.story.updateStatus);

  // TanStack mutation for deleting a story
  const { mutate: deleteStory, isPending: isDeleting } = useMutation({
    mutationFn: (storyId: Id<"story">) => deleteStoryMutation({ storyId }),
    onSuccess: () => {
      toast.success(t("storyDeletedSuccess"));
    },
    onError: (error) => {
      toast.error(t("storyDeletedError"), {
        description: error instanceof Error ? error.message : t("unknownError"),
      });
    },
  });

  // TanStack mutation for updating a story's status
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useMutation({
    mutationFn: (variables: {
      storyId: Id<"story">;
      status: Doc<"story">["status"];
    }) => updateStatusMutation(variables),
    onSuccess: (_, variables) => {
      if (variables.status === "archived") {
        toast.success(t("storyArchivedSuccess"));
      } else if (variables.status === "draft") {
        toast.success(t("storyUnarchivedSuccess"));
      }
    },
    onError: (error) => {
      toast.error(t("storyStatusUpdateError"), {
        description: error instanceof Error ? error.message : t("unknownError"),
      });
    },
  });

  return {
    deleteStory,
    isDeleting,
    updateStatus,
    isUpdatingStatus,
  };
}
