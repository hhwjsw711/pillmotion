import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useConvexMutation, convexQuery } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function useStoryDetailPage(storyId: Id<"story">) {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery(
    convexQuery(api.story.getStoryPageData, { storyId }),
  );
  const story = data?.story;
  const videoVersion = data?.videoVersion;

  const { mutate: generateVideo, isPending: isRequestingVideoGeneration } =
    useMutation({
      mutationFn: useConvexMutation(api.story.generateVideo),
      onSuccess: () => {
        toast.success(t("toastVideoGenerationStarted"));
      },
      onError: (error) => {
        toast.error(t("toastVideoGenerationFailed"));
        console.error("Generate video failed:", error);
      },
    });

  const handleGenerateVideo = () => {
    if ((story?.segmentCount ?? 0) === 0) {
      toast.warning(t("mustHaveSegmentsToGenerateVideo"));
      return;
    }
    generateVideo({ storyId });
  };

  const isGeneratingVideo = useMemo(() => {
    if (isRequestingVideoGeneration) return true;
    if (!videoVersion) return false;
    return (
      videoVersion.generationStatus === "pending" ||
      videoVersion.generationStatus === "generating_clips" ||
      videoVersion.generationStatus === "merging_clips"
    );
  }, [isRequestingVideoGeneration, videoVersion]);

  const canGenerateVideo = (story?.segmentCount ?? 0) > 0;

  return {
    story,
    videoVersion,
    isLoading,
    isGeneratingVideo,
    canGenerateVideo,
    handleGenerateVideo,
  };
}
