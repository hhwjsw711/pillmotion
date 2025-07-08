import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Doc } from "~/convex/_generated/dataModel";
import { toast } from "sonner";
import { useApiErrorHandler } from "@/hooks/useApiErrorHandler";
import { useState } from "react";
import { Button } from "../../-components/Button";
import { ConfirmDialog } from "../../-components/ConfirmDialog";
import { RegenerateModal } from "./RegenerateModal";
import { isMobile } from "@/utils/misc";
import { useNavigate } from "@tanstack/react-router";
import { Route as DecorateIndexRoute } from "@/routes/_app/_auth/decorate/index";
import { Loader2 } from "lucide-react";

interface PromptPanelProps {
  image: Doc<"images">;
}

const defaultPrompt =
  "Please decorate this so it looks like a professional interior decorator has designed it";

export function PromptPanel({ image }: PromptPanelProps) {
  const canGenerate =
    !!image &&
    (image.status.kind === "uploaded" || image.status.kind === "generated");

  const currentPrompt =
    image &&
    (image.status.kind === "generating" || image.status.kind === "generated")
      ? image.status.prompt
      : undefined;

  const onApiError = useApiErrorHandler();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState(currentPrompt ?? defaultPrompt);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);

  // Convex mutations, called at the top level as hooks
  const startGeneration = useConvexMutation(api.images.startGeneration);
  const startRegeneration = useConvexMutation(api.images.startRegeneration);
  const deleteImage = useConvexMutation(api.images.deleteImage);

  // TanStack mutations
  const startGenerationMutation = useMutation({
    mutationFn: startGeneration,
    onError: onApiError,
  });

  const startRegenerationMutation = useMutation({
    mutationFn: startRegeneration,
    onError: onApiError,
  });

  const deleteImageMutation = useMutation({
    mutationFn: deleteImage,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [api.images.listImages],
      });
      navigate({ to: DecorateIndexRoute.to });
      toast.success("Image deleted successfully.");
    },
    onError: onApiError,
  });

  const isProcessing =
    startGenerationMutation.isPending ||
    startRegenerationMutation.isPending ||
    image.status.kind === "generating";

  const handleGenerate = () => {
    if (!canGenerate) {
      toast.error(
        "Please wait for the image to finish uploading before generating.",
      );
      return;
    }
    if (image.status.kind === "generated" && image.status.decoratedImage) {
      setShowRegenerateModal(true);
    } else {
      startGenerationMutation.mutate({ imageId: image._id, prompt });
    }
  };

  const handleSelectOriginal = () => {
    setShowRegenerateModal(false);
    startRegenerationMutation.mutate({
      imageId: image._id,
      prompt,
      baseImage: "original",
    });
  };

  const handleSelectDecorated = () => {
    setShowRegenerateModal(false);
    startRegenerationMutation.mutate({
      imageId: image._id,
      prompt,
      baseImage: "decorated",
    });
  };

  return (
    <div className="flex flex-col justify-between w-full md:w-1/2 md:max-w-[500px] max-w-full bg-white r p-8 pb-[100px] md:p-12 overflow-y-auto min-h-[320px] border-r border-[var(--color-border)]">
      <ConfirmDialog
        open={showConfirm}
        title="Delete image"
        message="Are you sure you want to delete this image? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => deleteImageMutation.mutate({ imageId: image._id })}
        onCancel={() => setShowConfirm(false)}
      />
      <RegenerateModal
        open={showRegenerateModal}
        originalImageUrl={
          image.status.kind === "generated" && image.status.image
            ? image.status.image.url
            : ""
        }
        decoratedImageUrl={
          image.status.kind === "generated" && image.status.decoratedImage
            ? image.status.decoratedImage.url
            : ""
        }
        onSelectOriginal={handleSelectOriginal}
        onSelectDecorated={handleSelectDecorated}
        onCancel={() => setShowRegenerateModal(false)}
      />
      <div>
        <h2 className="text-2xl font-bold mb-4 text-slate-800">Image Prompt</h2>
        <p className="text-sm text-gray-500 mb-4">
          Enter a description of how you want your image to be decorated.
        </p>
        <textarea
          id="prompt"
          className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px] resize-y text-base mb-4 shadow-sm"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onFocus={(e) => {
            // Select all text on mobile devices when focused
            if (isMobile()) e.target.select();
          }}
          placeholder={defaultPrompt}
          disabled={!canGenerate}
        />
      </div>
      <div className="flex flex-col gap-2 mt-4">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canGenerate || isProcessing}
          onClick={handleGenerate}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </span>
          ) : currentPrompt ? (
            "Re-generate"
          ) : (
            "Generate"
          )}
        </Button>
        <Button
          variant="danger"
          fullWidth
          onClick={() => setShowConfirm(true)}
          disabled={deleteImageMutation.isPending}
          aria-label="Delete"
        >
          {deleteImageMutation.isPending ? (
            <span className="flex items-center justify-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deleting...
            </span>
          ) : (
            "Delete image"
          )}
        </Button>
      </div>
    </div>
  );
}
