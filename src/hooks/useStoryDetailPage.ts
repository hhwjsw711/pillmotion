import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  useConvexMutation,
  convexQuery,
  useConvex,
} from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useVideoRenderer } from "./useVideoRenderer";

export function useStoryDetailPage(storyId: Id<"story">) {
  const { t } = useTranslation();
  const convex = useConvex();

  const { data, isLoading, refetch } = useQuery(
    convexQuery(api.story.getStoryPageData, { storyId }),
  );
  const story = data?.story;
  const videoVersion = data?.videoVersion;

  // Manual Stitching Logic
  const {
    renderVideo,
    isRendering: isStitching,
    progress: stitchingProgress,
    load: loadRenderer,
  } = useVideoRenderer();

  // [FIX] Use the mutation for generating an upload URL from `convex/files.ts`
  const generateUploadUrl = useConvexMutation(api.files.generateUploadUrl);
  const saveStitchedVideoMutation = useConvexMutation(
    api.video.saveStitchedVideo,
  );

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

  const handleStitchVideo = async () => {
    if (!videoVersion) {
      toast.error(t("noVideoVersionToStitch"));
      return;
    }

    try {
      toast.info(t("toastVideoStitchingStarted"));
      await loadRenderer(); // Safe to call multiple times
      const renderData = await convex.query(api.video.getVideoRenderData, {
        storyId,
      });

      if (!renderData || renderData.length === 0) {
        throw new Error("No video clips have been selected for stitching.");
      }
      if (renderData.length !== story?.segmentCount) {
        toast.warning(
          `Only ${renderData.length} out of ${story?.segmentCount} scenes have a selected video clip. The final video will only contain these clips.`,
        );
      }

      const stitchedVideoUrl = await renderVideo(renderData);
      if (!stitchedVideoUrl) {
        throw new Error("Client-side rendering failed to produce a video.");
      }

      toast.info(t("toastUploadingStitchedVideo"));
      const videoBlob = await fetch(stitchedVideoUrl).then((res) => res.blob());
      URL.revokeObjectURL(stitchedVideoUrl); // Clean up blob URL to prevent memory leaks

      // [FIX] Implement the correct manual upload flow
      // 1. Get the upload URL from our backend
      const postUrl = await generateUploadUrl();

      // 2. Post the file to the URL
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": videoBlob.type },
        body: videoBlob,
      });
      const { storageId } = await result.json();

      if (!storageId) {
        throw new Error("Upload failed: storageId not received from server.");
      }

      // 3. Save the new storageId to the videoVersion
      await saveStitchedVideoMutation({
        videoVersionId: videoVersion._id,
        storageId,
      });

      toast.success(t("toastVideoStitchingComplete"));
      refetch(); // Refetch data to show the new video player
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("unknownError");
      toast.error(t("toastVideoStitchingFailed"), { description: message });
      console.error("Video stitching failed:", error);
    }
  };

  const isGeneratingClips = useMemo(() => {
    if (isRequestingVideoGeneration) return true;
    if (!videoVersion) return false;
    return (
      videoVersion.generationStatus === "pending" ||
      videoVersion.generationStatus === "generating_clips"
    );
  }, [isRequestingVideoGeneration, videoVersion]);

  const canGenerateVideo = (story?.segmentCount ?? 0) > 0;

  const canStitchVideo =
    videoVersion?.generationStatus === "generated" && !videoVersion.storageId;

  return {
    story,
    videoVersion,
    isLoading,
    isGeneratingClips,
    isStitching,
    stitchingProgress,
    canGenerateVideo,
    canStitchVideo,
    handleGenerateVideo,
    handleStitchVideo,
  };
}
