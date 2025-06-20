import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useConvexMutation, convexQuery } from "@convex-dev/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { StoryFormat } from "~/convex/schema";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

/**
 * A comprehensive hook to manage the state and logic for the RefineStory page.
 * It handles data fetching, dialog state, format selection, and the segment
 * generation mutation.
 *
 * @param storyId The ID of the story being refined.
 * @returns All the state and handlers needed by the RefineStory component.
 */
export function useRefinePage(storyId: Id<"story">) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // 1. Data Fetching: Get the story data.
  const story = useQuery(convexQuery(api.story.getStory, { storyId }));

  // 2. State Management: Handle dialog visibility and format selection.
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [format, setFormat] = useState<StoryFormat>("vertical");

  // 3. Navigation Logic: Redirect if the story is not found or deleted.
  useEffect(() => {
    if (story.data === null) {
      toast.error(t("storyNotFoundOrDeleted", "Story not found or has been deleted."));
      navigate({ to: "/stories" });
    }
  }, [story.data, navigate, t]);

  // 4. Mutation Logic: Handle the segment generation process.
  const { mutateAsync: generateSegments, isPending: isGenerating } =
    useMutation({
      mutationFn: useConvexMutation(api.story.generateSegments),
    });

  const handleGenerateSegments = async () => {
    try {
      await generateSegments({ storyId, format });
      toast.success(t("toastSegmentsGenerationStarted"));
      setIsGenerateDialogOpen(false);
      navigate({ to: "/stories/$storyId", params: { storyId } });
    } catch (error) {
      toast.error(t("toastSegmentsGenerationFailed"));
      console.error("Generate segments failed:", error);
    }
  };

  // 5. Expose all necessary state and functions to the component.
  return {
    story: story.data,
    isLoading: story.isLoading,
    isGenerateDialogOpen,
    setIsGenerateDialogOpen,
    format,
    setFormat,
    isGenerating,
    handleGenerateSegments,
  };
}