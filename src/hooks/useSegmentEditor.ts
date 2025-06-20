import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id, Doc } from "~/convex/_generated/dataModel";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export type VersionWithUrl = Doc<"imageVersions"> & {
  previewImageUrl: string | null;
};

/**
 * A comprehensive hook to manage the state and logic for the SegmentEditor page.
 * It handles data fetching, form state, and all image-related mutations.
 *
 * @param segmentId The ID of the segment being edited.
 * @returns All the state and handlers needed by the SegmentEditor component.
 */
export function useSegmentEditor(segmentId: Id<"segments">) {
  const { t } = useTranslation();

  // 1. DATA FETCHING
  const segment = useQuery(api.segments.get, { id: segmentId });
  const versions = useQuery(api.imageVersions.getBySegment, { segmentId });
  const selectedVersion = useMemo(
    () => versions?.find((v) => v._id === segment?.selectedVersionId),
    [versions, segment],
  );
  const imageUrl = useQuery(
    api.files.getFileUrl,
    selectedVersion?.image ? { storageId: selectedVersion.image } : "skip",
  );

  // 2. STATE MANAGEMENT
  const [promptText, setPromptText] = useState("");
  const [tuningPrompt, setTuningPrompt] = useState("");

  // 3. MUTATIONS
  const { mutateAsync: regenerateImage, isPending: isRegenerating } =
    useMutation({
      mutationFn: useConvexMutation(api.segments.regenerateImage),
    });

  const { mutateAsync: editImage, isPending: isEditing } = useMutation({
    mutationFn: useConvexMutation(api.segments.editImage),
  });

  const { mutate: selectVersion, isPending: isSelecting } = useMutation({
    mutationFn: useConvexMutation(api.imageVersions.selectVersion),
    onSuccess: () => toast.success(t("toastVersionSelected")),
    onError: (err) => {
      toast.error(t("toastVersionSelectFailed"));
      console.error(err);
    },
  });

  // 4. DERIVED STATE
  const isProcessing = segment?.isGenerating || isRegenerating || isEditing;

  // 5. SIDE EFFECTS
  useEffect(() => {
    // Sync prompt text area with the most relevant prompt
    if (selectedVersion?.prompt) {
      setPromptText(selectedVersion.prompt);
    } else {
      const latestAiVersion = versions?.find((v) => v.source === "ai_generated");
      setPromptText(latestAiVersion?.prompt ?? "");
    }
  }, [selectedVersion, versions]);

  useEffect(() => {
    // Toast notification when background processing is finished
    if (segment?.isGenerating === false && segment.error) {
      toast.error(t("toastImageProcessFailed"), {
        description: segment.error,
      });
    }
  }, [segment?.isGenerating, segment?.error, t]);

  // 6. EVENT HANDLERS
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

  return {
    // Data
    segment,
    versions: versions as VersionWithUrl[] | undefined,
    selectedVersion,
    imageUrl,
    // Form State
    promptText,
    setPromptText,
    tuningPrompt,
    setTuningPrompt,
    // Handlers
    handleRegenerate,
    handleEditImage,
    selectVersion,
    // Statuses
    isProcessing,
    isSelecting,
    isEditing,
    isRegenerating,
    isLoading: segment === undefined || versions === undefined,
  };
}