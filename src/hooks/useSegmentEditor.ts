import { useState, useMemo, useEffect } from "react";
import {
  useQuery,
  useMutation as useTanstackMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useConvexMutation, convexQuery } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id, Doc } from "~/convex/_generated/dataModel";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

// [UPGRADE] Expand the sub-version type to include the new posterUrl.
export type ImageVersionWithSubVersions = Doc<"imageVersions"> & {
  previewImageUrl: string | null;
  videoSubVersions: (Doc<"videoClipVersions"> & {
    videoUrl: string | null;
    posterUrl: string | null;
  })[];
};

// [NEW] Define a type for the new unified timeline model
export type HistoryTimelineNode =
  | {
      type: "image";
      version: ImageVersionWithSubVersions;
      _creationTime: number;
    }
  | {
      type: "video";
      version: Doc<"videoClipVersions"> & {
        videoUrl: string | null;
        posterUrl: string | null;
      };
      _creationTime: number;
    };

export function useSegmentEditor(segmentId: Id<"segments">) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // 1. DATA FETCHING (Unchanged)
  const queryKey = useMemo(
    () => convexQuery(api.segments.getSegmentEditorData, { segmentId }),
    [segmentId],
  );
  const { data, isLoading, refetch } = useQuery(queryKey);

  const segment = data?.segment;
  const imageVersions = data?.imageVersions ?? [];
  const videoClipVersions = data?.videoClipVersions ?? [];

  // [REFACTOR] Create a unified, sorted timeline instead of the old tree structure
  const versionHistory: HistoryTimelineNode[] = useMemo(() => {
    // 1. Create nodes for each image version, attaching their video children
    const imageNodes: HistoryTimelineNode[] = imageVersions.map((img) => {
      const subVersions = videoClipVersions.filter(
        (vid) =>
          vid.context.type === "image_to_video" &&
          vid.context.sourceImageId === img._id,
      );
      return {
        type: "image",
        version: {
          ...img,
          videoSubVersions: subVersions,
        },
        _creationTime: img._creationTime,
      };
    });

    // 2. Create nodes for standalone text-to-video clips
    const standaloneVideoNodes: HistoryTimelineNode[] = videoClipVersions
      .filter((vid) => vid.context.type === "text_to_video")
      .map((vid) => ({
        type: "video",
        version: vid,
        _creationTime: vid._creationTime,
      }));

    // 3. Combine and sort into a single timeline, newest first
    return [...imageNodes, ...standaloneVideoNodes].sort(
      (a, b) => b._creationTime - a._creationTime,
    );
  }, [imageVersions, videoClipVersions]);

  const selectedImageVersion = useMemo(
    () => imageVersions.find((v) => v._id === segment?.selectedVersionId),
    [imageVersions, segment?.selectedVersionId],
  );

  const selectedVideoClipVersion = useMemo(
    () =>
      videoClipVersions.find(
        (v) => v._id === segment?.selectedVideoClipVersionId,
      ),
    [videoClipVersions, segment?.selectedVideoClipVersionId],
  );

  // 3. STATE MANAGEMENT (Unchanged)
  const [promptText, setPromptText] = useState("");
  const [tuningPrompt, setTuningPrompt] = useState("");

  // 4. MUTATIONS (REFACTORED to return full mutation objects)
  const invalidateSegmentData = () =>
    queryClient.invalidateQueries({ queryKey: queryKey.queryKey });

  const regenerateImageMutation = useTanstackMutation({
    mutationFn: useConvexMutation(api.segments.regenerateImage),
    onSuccess: () => {
      toast.success(t("toastNewImageGenerationStarted"));
      invalidateSegmentData();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const editImageMutation = useTanstackMutation({
    mutationFn: useConvexMutation(api.segments.editImage),
    onSuccess: () => {
      toast.success(t("toastImageEditStarted"));
      setTuningPrompt(""); // Also clear the prompt on success
      invalidateSegmentData();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const selectImageMutation = useTanstackMutation({
    mutationFn: useConvexMutation(api.imageVersions.selectVersion),
    onSuccess: () => {
      toast.success(t("toastVersionSelected"));
      invalidateSegmentData();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const selectVideoMutation = useTanstackMutation({
    mutationFn: useConvexMutation(api.segments.selectVideoClipVersion),
    onSuccess: () => {
      toast.success(t("toastVersionSelected"));
      invalidateSegmentData();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const generateImageToVideoMutation = useTanstackMutation({
    mutationFn: useConvexMutation(api.segments.generateImageToVideo),
    onSuccess: () => {
      toast.success(t("toastVideoClipGenerationStarted"));
      invalidateSegmentData();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const generateTextToVideoMutation = useTanstackMutation({
    mutationFn: useConvexMutation(api.segments.generateTextToVideo),
    onSuccess: () => {
      toast.success(t("toastVideoClipGenerationStarted"));
      invalidateSegmentData();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // 5. DERIVED STATE (Simplified)
  const isSelecting =
    selectImageMutation.isPending || selectVideoMutation.isPending;
  const isGenerating = segment?.isGenerating; // The backend now provides the single source of truth

  // 6. SIDE EFFECTS (Unchanged)
  useEffect(() => {
    if (selectedImageVersion?.prompt) {
      setPromptText(selectedImageVersion.prompt);
    } else if (imageVersions.length > 0) {
      const latestAiVersion = imageVersions.find(
        (v) => v.source === "ai_generated",
      );
      setPromptText(latestAiVersion?.prompt ?? "");
    }
  }, [selectedImageVersion, imageVersions]);

  useEffect(() => {
    if (segment?.isGenerating === false && segment.error) {
      toast.error(t("toastImageProcessFailed"), {
        description: segment.error,
      });
      invalidateSegmentData();
    }
  }, [segment?.isGenerating, segment?.error, t, invalidateSegmentData]);

  return {
    // Data
    segment,
    versionHistory, // [REPLACE] Export the new unified timeline
    selectedImageVersion,
    selectedVideoClipVersion,
    // State
    isLoading,
    isGenerating,
    isSelecting,
    promptText,
    setPromptText,
    tuningPrompt,
    setTuningPrompt,
    // Mutations (return the full objects)
    regenerateImageMutation,
    editImageMutation,
    selectImageMutation,
    selectVideoMutation,
    generateImageToVideoMutation,
    generateTextToVideoMutation,
    // Actions
    refetch,
  };
}
