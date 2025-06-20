import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function useEditableTitle(storyId: Id<"story">, initialTitle: string) {
  const { t } = useTranslation();
  const [isSuccess, setIsSuccess] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: useConvexMutation(api.story.updateStoryTitle),
    onSuccess: () => {
      setIsSuccess(true);
      const timer = setTimeout(() => setIsSuccess(false), 2000);
      // This is a good practice: return a cleanup function.
      return () => clearTimeout(timer);
    },
    onError: (err) => {
      toast.error(t("toastTitleUpdateFailed"), {
        description: (err as Error).message,
      });
    },
  });

  const handleTitleChange = (newTitle: string) => {
    const trimmedTitle = newTitle.trim();
    if (trimmedTitle && trimmedTitle !== initialTitle) {
      mutate({ storyId, title: trimmedTitle });
    }
  };

  return {
    isPending,
    isSuccess,
    handleTitleChange,
  };
}