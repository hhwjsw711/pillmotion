import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useConvexMutation,
  convexQuery,
  useConvex,
} from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Doc, Id } from "~/convex/_generated/dataModel";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useVideoRenderer } from "./useVideoRenderer";
import { useNavigate } from "@tanstack/react-router";
import { useSensor, PointerSensor, DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

// [FIXED] Manually defining the return type of `getStoryPageData` to ensure type safety
// without relying on an `InferQueryOutput` helper that may not exist in this project's version.
type StoryPageData = {
  story: Doc<"story"> & { segmentCount: number };
  segments: (Doc<"segments"> & {
    previewImageUrl: string | null;
    posterUrl: string | null;
    videoUrl: string | null;
  })[];
  videoVersion: (Doc<"videoVersions"> & { videoUrl: string | null }) | null;
} | null;

type SegmentWithPreview = NonNullable<StoryPageData>["segments"][number];

export function useStoryDetailPage(storyId: Id<"story">) {
  const { t } = useTranslation();
  const convex = useConvex();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // [MODIFIED] This is now our single source of truth for all page data.
  const query = convexQuery(api.story.getStoryPageData, { storyId });
  const { data, isLoading, refetch } = useQuery(query);

  const story = data?.story;
  const videoVersion = data?.videoVersion;
  const segments = data?.segments;

  // --- [LOGIC MOVED FROM useStorySegments] ---
  const [activeSegments, setActiveSegments] = useState<SegmentWithPreview[]>(
    [],
  );
  useEffect(() => {
    if (segments) {
      setActiveSegments(segments);
    }
  }, [segments]);

  const reorderMutation = useConvexMutation(api.segments.reorderSegments);
  const { mutate: reorderSegments } = useMutation({
    mutationFn: async (orderedIds: Id<"segments">[]) => {
      await reorderMutation({ storyId, segmentIds: orderedIds });
    },
    onSuccess: () => {
      toast.success(t("toastOrderSaved"));
      queryClient.invalidateQueries({ queryKey: query.queryKey });
    },
    onError: (err) => {
      toast.error(t("toastOrderSaveFailed"), {
        description: err instanceof Error ? err.message : t("unknownError"),
      });
      if (segments) setActiveSegments(segments); // Revert on error
    },
  });

  const addSegmentMutation = useConvexMutation(api.segments.addSegment);
  const { mutate: addSegment, isPending: isAddingSegment } = useMutation({
    mutationFn: async () => {
      const newSegmentId = await addSegmentMutation({ storyId });
      if (!newSegmentId) throw new Error("Backend did not return a new ID.");
      return newSegmentId;
    },
    onSuccess: (newSegmentId) => {
      toast.success(t("toastSegmentAdded"));
      queryClient.invalidateQueries({ queryKey: query.queryKey });
      navigate({
        to: "/stories/$storyId/segments/$segmentId",
        params: { storyId, segmentId: newSegmentId },
      });
    },
    onError: (err) => {
      toast.error(t("toastSegmentAddFailed"), {
        description: err instanceof Error ? err.message : t("unknownError"),
      });
    },
  });

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setActiveSegments((items) => {
        const oldIndex = items.findIndex((item) => item._id === active.id);
        const newIndex = items.findIndex((item) => item._id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        reorderSegments(newOrder.map((item) => item._id));
        return newOrder;
      });
    }
  }
  // --- [END MOVED LOGIC] ---

  const {
    renderVideo,
    isRendering: isStitching,
    progress: stitchingProgress,
    load: loadRenderer,
  } = useVideoRenderer();

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
      await loadRenderer();
      const renderConfig = await convex.query(api.video.getVideoRenderData, {
        storyId,
      });

      if (!renderConfig?.clips?.length) {
        throw new Error(t("toastNoClipsSelectedForStitching"));
      }
      if (renderConfig.clips.length !== story?.segmentCount) {
        toast.warning(
          t("toastPartialStitchWarning", {
            count: renderConfig.clips.length,
            total: story?.segmentCount,
          }),
        );
      }

      const stitchedVideoUrl = await renderVideo(renderConfig);
      if (!stitchedVideoUrl) throw new Error(t("toastRenderFailed"));

      toast.info(t("toastUploadingStitchedVideo"));
      const videoBlob = await fetch(stitchedVideoUrl).then((res) => res.blob());
      URL.revokeObjectURL(stitchedVideoUrl);

      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": videoBlob.type },
        body: videoBlob,
      });
      const { storageId } = await result.json();

      if (!storageId) throw new Error("Upload failed");

      await saveStitchedVideoMutation({
        videoVersionId: videoVersion._id,
        storageId,
      });

      toast.success(t("toastVideoStitchingComplete"));
      refetch();
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
    // [NEW] Export all segment-related data and functions
    segments: activeSegments,
    isAddingSegment,
    addSegment,
    handleDragEnd,
    pointerSensor,
    // Original exports
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
