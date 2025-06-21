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

// The data structure for an image version, now including its video children
export type ImageVersionWithSubVersions = Doc<"imageVersions"> & {
  imageUrl: string | null;
  previewImageUrl: string | null;
  videoSubVersions: Doc<"videoClipVersions">[];
};

export type DisplayMode = "image" | "video";

export function useSegmentEditor(segmentId: Id<"segments">) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // 1. DATA FETCHING (Unchanged)
  const { data, isLoading, refetch } = useQuery(
    convexQuery(api.segments.getSegmentEditorData, { segmentId }),
  );

  const segment = data?.segment;
  const imageVersions = data?.imageVersions;
  const videoClip = data?.videoClip;
  const image = data?.image;

  const [displayMode, setDisplayMode] = useState<DisplayMode>("image");

  const selectedImageVersion = useMemo(
    () => imageVersions?.find((v) => v._id === segment?.selectedVersionId),
    [imageVersions, segment?.selectedVersionId],
  );

  const imageUrl = image?.url;
  const videoClipUrl = videoClip?.url;

  useEffect(() => {
    // 当数据加载或刷新时，根据后端返回的选中状态，智能地决定初始显示模式
    if (segment?.selectedVideoClipVersionId && videoClipUrl) {
      setDisplayMode("video");
    } else {
      setDisplayMode("image");
    }
  }, [segment?.selectedVideoClipVersionId, videoClipUrl]);

  // 2. STATE MANAGEMENT (Unchanged)
  const [promptText, setPromptText] = useState("");
  const [tuningPrompt, setTuningPrompt] = useState("");

  // 3. MUTATIONS (Corrected to the right pattern)
  const { mutateAsync: regenerateImage, isPending: isRegenerating } =
    useTanstackMutation({
      mutationFn: useConvexMutation(api.segments.regenerateImage),
    });

  const { mutateAsync: editImage, isPending: isEditing } = useTanstackMutation({
    mutationFn: useConvexMutation(api.segments.editImage),
  });

  const { mutateAsync: selectImage, isPending: isSelectingImage } =
    useTanstackMutation({
      mutationFn: useConvexMutation(api.imageVersions.selectVersion),
    });

  const { mutateAsync: selectVideo, isPending: isSelectingVideo } =
    useTanstackMutation({
      mutationFn: useConvexMutation(api.segments.selectVideoClipVersion),
    });

  const {
    mutateAsync: generateVideoForImage,
    isPending: isGeneratingVideo,
    variables: generatingVideoVariables,
  } = useTanstackMutation({
    mutationFn: useConvexMutation(api.segments.generateVideoClipForSegment),
    onSuccess: () => {
      toast.success(t("toastVideoClipGenerationStarted"));
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.segments.getSegmentEditorData, {
          segmentId,
        }).queryKey,
      });
    },
    onError: (error) => {
      toast.error(t("toastVideoClipGenerationFailed"), {
        description: error.message,
      });
    },
  });

  const isSelecting = isSelectingImage || isSelectingVideo;

  // 4. DERIVED STATE (Unchanged)
  const isProcessing =
    segment?.isGenerating || isRegenerating || isEditing || isGeneratingVideo;

  // 5. SIDE EFFECTS (Unchanged, but good)
  useEffect(() => {
    if (selectedImageVersion?.prompt) {
      setPromptText(selectedImageVersion.prompt);
    } else if (imageVersions && imageVersions.length > 0) {
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
      refetch(); // Refetch data on error to get updated status
    }
  }, [segment?.isGenerating, segment?.error, t, refetch]);

  // 6. EVENT HANDLERS (Now work correctly with the fixed mutations)
  const handleRegenerate = async () => {
    if (!promptText.trim()) return toast.error(t("toastPromptEmpty"));
    await regenerateImage({ segmentId, prompt: promptText });
    toast.success(t("toastNewImageGenerationStarted"));
  };

  const handleEditImage = async () => {
    if (!tuningPrompt.trim()) return toast.error(t("toastEditPromptEmpty"));
    if (!selectedImageVersion) return toast.error(t("toastNoVersionSelected"));
    await editImage({
      segmentId,
      prompt: tuningPrompt,
      versionIdToEdit: selectedImageVersion._id,
    });
    toast.success(t("toastImageEditStarted"));
    setTuningPrompt("");
  };

  const handleSelectVersion = async (
    type: DisplayMode,
    versionId: Id<"imageVersions"> | Id<"videoClipVersions">,
  ) => {
    if (isSelecting) return;
    try {
      const promise =
        type === "image"
          ? selectImage({
              segmentId,
              versionId: versionId as Id<"imageVersions">,
            })
          : selectVideo({
              segmentId,
              videoClipVersionId: versionId as Id<"videoClipVersions">,
            });

      // 关键改动：根据用户选择的类型，立即切换前端的显示模式
      setDisplayMode(type);

      await promise;
      toast.success(t("toastVersionSelected"));
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.segments.getSegmentEditorData, { segmentId })
          .queryKey,
      });
    } catch (err) {
      toast.error(t("toastVersionSelectFailed"));
      console.error(err);
    }
  };

  return {
    segment,
    imageVersions,
    imageUrl,
    videoClipUrl,
    displayMode,
    promptText,
    setPromptText,
    tuningPrompt,
    setTuningPrompt,
    handleRegenerate,
    handleEditImage,
    handleSelectVersion,
    isProcessing,
    isSelecting,
    isEditing,
    isRegenerating,
    isLoading,
    generateVideoForImage,
    isGeneratingVideo,
    generatingVideoVariables,
  };
}
