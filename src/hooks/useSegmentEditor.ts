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

export type ImageVersionWithSubVersions = Doc<"imageVersions"> & {
  previewImageUrl: string | null;
  videoSubVersions: (Doc<"videoClipVersions"> & {
    videoUrl: string | null;
    posterUrl: string | null;
    lastFramePosterUrl: string | null;
  })[];
};

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
        lastFramePosterUrl: string | null;
      };
      _creationTime: number;
    };

export function useSegmentEditor(segmentId: Id<"segments">) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () => convexQuery(api.segments.getSegmentEditorData, { segmentId }),
    [segmentId],
  );
  const { data, isLoading, refetch } = useQuery(queryKey);

  const segment = data?.segment;
  const imageVersions = data?.imageVersions ?? [];
  const videoClipVersions = data?.videoClipVersions ?? [];

  const versionHistory: HistoryTimelineNode[] = useMemo(() => {
    if (!data) return [];

    const videoVersionsMap = new Map<
      Id<"imageVersions">,
      (Doc<"videoClipVersions"> & {
        videoUrl: string | null;
        posterUrl: string | null;
        lastFramePosterUrl: string | null;
      })[]
    >();
    const standaloneVideoClips: HistoryTimelineNode[] = [];

    videoClipVersions.forEach((clip) => {
      let parentImageId: Id<"imageVersions"> | undefined = undefined;
      // [FIX] Only "image_to_video" has a sourceImageId. This prevents crashes.
      if (clip.context.type === "image_to_video") {
        parentImageId = clip.context.sourceImageId;
      }

      if (parentImageId && imageVersions.some((v) => v._id === parentImageId)) {
        if (!videoVersionsMap.has(parentImageId)) {
          videoVersionsMap.set(parentImageId, []);
        }
        videoVersionsMap.get(parentImageId)!.push(clip);
      } else {
        // [FIX] All other video types are correctly treated as standalone top-level nodes.
        standaloneVideoClips.push({
          type: "video",
          version: clip,
          _creationTime: clip._creationTime,
        });
      }
    });

    const imageNodes: HistoryTimelineNode[] = imageVersions.map((version) => ({
      type: "image",
      version: {
        ...version,
        videoSubVersions: videoVersionsMap.get(version._id) ?? [],
      },
      _creationTime: version._creationTime,
    }));

    return [...imageNodes, ...standaloneVideoClips].sort(
      (a, b) => b._creationTime - a._creationTime,
    );
  }, [imageVersions, videoClipVersions, data]);

  const selectedImageVersion = useMemo(
    // [FIX] Consistently use 'selectedVersionId' as hinted by the error message.
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

  const [promptText, setPromptText] = useState("");
  const [tuningPrompt, setTuningPrompt] = useState("");
  const [startFrameSourceId, setStartFrameSourceId] = useState<
    Id<"imageVersions"> | Id<"videoClipVersions"> | null
  >(null);
  const [endFrameSourceId, setEndFrameSourceId] = useState<
    Id<"imageVersions"> | Id<"videoClipVersions"> | null
  >(null);
  const [transitionPrompt, setTransitionPrompt] = useState("");

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
      setTuningPrompt("");
      invalidateSegmentData();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const selectImageMutation = useTanstackMutation({
    // [FIX] Use the consistent and logical API endpoint on `segments`.
    mutationFn: useConvexMutation(api.segments.selectImageVersion),
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

  const generateTransitionMutation = useTanstackMutation({
    mutationFn: useConvexMutation(api.video.generateTransition),
    onSuccess: () => {
      toast.success(t("toastTransitionGenerationStarted"));
      setStartFrameSourceId(null);
      setEndFrameSourceId(null);
      setTransitionPrompt("");
      invalidateSegmentData();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const isSelecting =
    selectImageMutation.isPending || selectVideoMutation.isPending;
  const isGenerating = segment?.isGenerating;

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
    if (segment?.isGenerating === false && segment?.error) {
      toast.error(t("toastImageProcessFailed"), {
        description: segment.error,
      });
      invalidateSegmentData();
    }
  }, [segment, t, invalidateSegmentData]);

  return {
    segment,
    versionHistory,
    selectedImageVersion,
    selectedVideoClipVersion,
    isLoading,
    isGenerating,
    isSelecting,
    promptText,
    setPromptText,
    tuningPrompt,
    setTuningPrompt,
    startFrameSourceId,
    setStartFrameSourceId,
    endFrameSourceId,
    setEndFrameSourceId,
    transitionPrompt,
    setTransitionPrompt,
    regenerateImageMutation,
    editImageMutation,
    selectImageMutation,
    selectVideoMutation,
    generateImageToVideoMutation,
    generateTextToVideoMutation,
    generateTransitionMutation,
    refetch,
  };
}
