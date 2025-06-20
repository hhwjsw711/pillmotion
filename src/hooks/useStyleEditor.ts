import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export type AutoSaveStatus = "idle" | "saving" | "success" | "error";

/**
 * A custom hook to encapsulate all logic for the StyleEditor component.
 * It now features a debounced auto-save functionality for a seamless UX.
 *
 * @param storyId The ID of the story whose style is being edited.
 * @returns An object containing the state and handlers for the UI.
 */
export function useStyleEditor(storyId: Id<"story">) {
  const { t } = useTranslation();

  const { data: story, isLoading: isStoryLoading } = useQuery(
    convexQuery(api.story.getStory, { storyId }),
  );

  const [stylePrompt, setStylePrompt] = useState("");
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Initialize state from the fetched data
  useEffect(() => {
    if (story) {
      setStylePrompt(story.stylePrompt ?? "");
      setStatus("idle");
    }
  }, [story]);

  const updateStylePromptMutation = useConvexMutation(
    api.story.updateStylePrompt,
  );
  const { mutate: updateStylePrompt } = useMutation({
    mutationFn: async (newPrompt: string) => {
      // The component will have already updated the state optimistically.
      // We just need to fire the mutation.
      await updateStylePromptMutation({
        storyId,
        stylePrompt: newPrompt,
      });
    },
    onMutate: () => {
      setStatus("saving");
    },
    onSuccess: () => {
      setStatus("success");
    },
    onError: (err) => {
      setStatus("error");
      toast.error(t("toastStyleSaveFailed"), {
        description: (err as Error).message,
      });
    },
  });

  // The auto-save effect
  useEffect(() => {
    // Don't save if the prompt hasn't changed from the initial server state.
    if (story && stylePrompt === (story.stylePrompt ?? "")) {
      return;
    }

    // When the user types, clear any existing timeout.
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Set a new timeout to trigger the save after 1 second of inactivity.
    debounceTimeout.current = setTimeout(() => {
      updateStylePrompt(stylePrompt);
    }, 1000); // 1-second debounce

    // Cleanup on unmount.
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [stylePrompt, story, updateStylePrompt]);

  return {
    isStoryLoading,
    stylePrompt,
    setStylePrompt,
    saveStatus: status,
  };
}