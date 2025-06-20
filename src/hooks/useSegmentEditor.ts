import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation as useTanstackMutation } from "@tanstack/react-query";
import { useConvexMutation, convexQuery } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id, Doc } from "~/convex/_generated/dataModel";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

// This type definition now includes the full image URL.
export type VersionWithUrl = Doc<"imageVersions"> & {
  imageUrl: string | null;
  previewImageUrl: string | null;
};

export function useSegmentEditor(segmentId: Id<"segments">) {
  const { t } = useTranslation();

  // 1. UNIFIED DATA FETCHING
  // We now use our new, efficient query to get all data at once.
  const { data, isLoading } = useQuery(
    convexQuery(api.segments.getSegmentEditorData, { segmentId }),
  );

  // Derive all data from the single query result.
  const segment = data?.segment;
  const versions = data?.imageVersions;
  const videoClip = data?.videoClip;

  const selectedVersion = useMemo(
    () => versions?.find((v) => v._id === segment?.selectedVersionId),
    [versions, segment?.selectedVersionId],
  );

  const imageUrl = selectedVersion?.imageUrl;
  const videoClipUrl = videoClip?.url; // The video URL is now available.

  // 2. STATE MANAGEMENT (Unchanged)
  const [promptText, setPromptText] = useState("");
  const [tuningPrompt, setTuningPrompt] = useState("");

  // 3. MUTATIONS (Your existing mutations are preserved)
  const { mutateAsync: regenerateImage, isPending: isRegenerating } =
    useTanstackMutation({
      mutationFn: useConvexMutation(api.segments.regenerateImage),
    });

  const { mutateAsync: editImage, isPending: isEditing } = useTanstackMutation({
    mutationFn: useConvexMutation(api.segments.editImage),
  });

  const { mutate: selectVersion, isPending: isSelecting } = useTanstackMutation({
    mutationFn: useConvexMutation(api.imageVersions.selectVersion),
    onSuccess: () => toast.success(t("toastVersionSelected")),
    onError: (err) => {
      toast.error(t("toastVersionSelectFailed"));
      console.error(err);
    },
  });

  // 4. DERIVED STATE (Unchanged)
  const isProcessing = segment?.isGenerating || isRegenerating || isEditing;

  // 5. SIDE EFFECTS (Your existing effects are preserved)
  useEffect(() => {
    if (selectedVersion?.prompt) {
      setPromptText(selectedVersion.prompt);
    } else {
      const latestAiVersion = versions?.find((v) => v.source === "ai_generated");
      setPromptText(latestAiVersion?.prompt ?? "");
    }
  }, [selectedVersion, versions]);

  useEffect(() => {
    if (segment?.isGenerating === false && segment.error) {
      toast.error(t("toastImageProcessFailed"), {
        description: segment.error,
      });
    }
  }, [segment?.isGenerating, segment?.error, t]);

  // 6. EVENT HANDLERS (Your existing handlers are preserved)
  const handleRegenerate = async () => {
    if (!promptText.trim()) return toast.error(t("toastPromptEmpty"));
    await regenerateImage({ segmentId, prompt: promptText });
    toast.success(t("toastNewImageGenerationStarted"));
  };

  const handleEditImage = async () => {
    if (!tuningPrompt.trim()) return toast.error(t("toastEditPromptEmpty"));
    if (!selectedVersion) return toast.error(t("toastNoVersionSelected"));
    await editImage({
      segmentId,
      prompt: tuningPrompt,
      versionIdToEdit: selectedVersion._id,
    });
    toast.success(t("toastImageEditStarted"));
    setTuningPrompt("");
  };

  // Return values, now including videoClipUrl
  return {
    segment,
    versions: versions as VersionWithUrl[] | undefined,
    selectedVersion,
    imageUrl,
    videoClipUrl, // EXPOSE THE VIDEO URL
    promptText,
    setPromptText,
    tuningPrompt,
    setTuningPrompt,
    handleRegenerate,
    handleEditImage,
    selectVersion,
    isProcessing,
    isSelecting,
    isEditing,
    isRegenerating,
    isLoading: isLoading,
  };
}