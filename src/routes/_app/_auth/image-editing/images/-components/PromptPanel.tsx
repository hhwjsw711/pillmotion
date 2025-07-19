import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";
import { Doc } from "@cvx/_generated/dataModel";
import { toast } from "sonner";
import { useApiErrorHandler } from "@/hooks/useApiErrorHandler";
import { useState } from "react";
import { Button } from "../../-components/Button";
import { ConfirmDialog } from "../../-components/ConfirmDialog";
import { RegenerateModal } from "./RegenerateModal";
import { isMobile } from "@/utils/misc";
import { useNavigate } from "@tanstack/react-router";
import { Route as ImageEditingRoute } from "@/routes/_app/_auth/image-editing/index";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/dialog";
import { ChevronDown, Plus } from "lucide-react";
import { Input } from "@/ui/input";
import { styleModels } from "@/lib/models";
import { cn } from "@/utils/misc";
import type { GenerationSettings } from "@/types/canvas";

interface PromptPanelProps {
  image: Doc<"images">;
}

export function PromptPanel({ image }: PromptPanelProps) {
  const canGenerate =
    !!image &&
    (image.status.kind === "uploaded" || image.status.kind === "generated");

  const currentPrompt =
    image &&
    (image.status.kind === "generating" || image.status.kind === "generated")
      ? image.status.generationSettings.prompt
      : undefined;

  const startGeneration = useMutation(api.images.startGeneration);
  const startRegeneration = useMutation(api.images.startRegeneration);
  const deleteImage = useMutation(api.images.deleteImage);
  const onApiError = useApiErrorHandler();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const navigate = useNavigate();
  const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false);
  const simpsonsStyle = styleModels.find((m) => m.id === "simpsons");
  const [generationSettings, setGenerationSettings] =
    useState<GenerationSettings>({
      prompt: simpsonsStyle?.prompt || "",
      loraUrl: simpsonsStyle?.loraUrl || "",
      styleId: simpsonsStyle?.id || "simpsons",
    });

  const handleDelete = async () => {
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setShowConfirm(false);
    await deleteImage({ imageId: image._id }).catch(onApiError);
    navigate({ to: ImageEditingRoute.fullPath });
  };

  const handleGenerate = () => {
    if (!canGenerate) {
      toast.error(
        "Please wait for the image to finish uploading before generating.",
      );
      return;
    }

    if (!generationSettings.prompt) {
      toast.error("No Prompt", {
        description: "Please enter a prompt to generate an image",
      });
      return;
    }

    // If this is a re-generation (image already has decorated version), show modal
    if (image.status.kind === "generated" && image.status.decoratedImage) {
      setShowRegenerateModal(true);
    } else {
      // First time generation, use startGeneration
      startGeneration({
        imageId: image._id,
        generationSettings,
      }).catch(onApiError);
    }
  };

  const handleSelectOriginal = () => {
    setShowRegenerateModal(false);
    startRegeneration({
      imageId: image._id,
      generationSettings,
      baseImage: "original",
    }).catch(onApiError);
  };

  const handleSelectDecorated = () => {
    setShowRegenerateModal(false);
    startRegeneration({
      imageId: image._id,
      generationSettings,
      baseImage: "decorated",
    }).catch(onApiError);
  };

  return (
    <div className="flex flex-col justify-between w-full md:w-1/2 md:max-w-[500px] max-w-full bg-white r p-8 pb-[100px] md:p-12 overflow-y-auto min-h-[320px] border-r border-border">
      <ConfirmDialog
        open={showConfirm}
        title="Delete image"
        message="Are you sure you want to delete this image? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDelete}
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
          value={generationSettings.prompt}
          onChange={(e) =>
            setGenerationSettings({
              ...generationSettings,
              prompt: e.target.value,
            })
          }
          style={{ fontSize: "16px" }}
          onFocus={(e) => {
            // Select all text on mobile devices when focused
            if (isMobile()) e.target.select();
          }}
          placeholder={`Enter a prompt...`}
          disabled={!canGenerate}
        />
      </div>

      {generationSettings.styleId === "custom" && (
        <Input
          value={generationSettings.loraUrl}
          onChange={(e) =>
            setGenerationSettings({
              ...generationSettings,
              loraUrl: e.target.value,
            })
          }
          placeholder="Kontext LoRA URL (optional)"
          className="w-full bg-background/50"
          style={{ fontSize: "16px" }}
        />
      )}

      {/* Style dropdown and Run button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Left side - Style selector button */}
          <Button
            variant="secondary"
            className="flex items-center gap-2"
            onClick={() => setIsStyleDialogOpen(true)}
          >
            {(() => {
              if (generationSettings.styleId === "custom") {
                return (
                  <>
                    <div className="w-5 h-5 rounded flex items-center justify-center">
                      <Plus className="h-3 w-3" />
                    </div>
                    <span className="text-sm">Custom</span>
                  </>
                );
              }
              const selectedModel =
                styleModels.find((m) => m.id === generationSettings.styleId) ||
                styleModels.find((m) => m.id === "simpsons");
              return (
                <>
                  <img
                    src={selectedModel?.imageSrc}
                    alt={selectedModel?.name}
                    className="w-5 h-5 rounded object-cover"
                  />
                  <span className="text-sm">
                    {selectedModel?.name || "Simpsons Style"}
                  </span>
                </>
              );
            })()}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-4">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canGenerate}
          onClick={handleGenerate}
        >
          {currentPrompt ? "Re-generate" : "Generate"}
        </Button>
        <Button
          variant="danger"
          fullWidth
          onClick={handleDelete}
          aria-label="Delete"
        >
          Delete image
        </Button>
      </div>

      {/* Style Selection Dialog */}
      <Dialog open={isStyleDialogOpen} onOpenChange={setIsStyleDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Choose a Style</DialogTitle>
            <DialogDescription>
              Select a style to apply to your images or choose Custom to use
              your own LoRA
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            {/* Fixed gradient overlays outside scrollable area */}
            <div className="pointer-events-none absolute -top-[1px] left-0 right-0 z-30 h-4 md:h-12 bg-gradient-to-b from-background via-background/90 to-transparent" />
            <div className="pointer-events-none absolute -bottom-[1px] left-0 right-0 z-30 h-4 md:h-12 bg-gradient-to-t from-background via-background/90 to-transparent" />

            {/* Scrollable content container */}
            <div className="overflow-y-auto max-h-[60vh] px-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-4 pb-6 md:pt-8 md:pb-12">
                {/* Custom option */}
                <button
                  onClick={() => {
                    setGenerationSettings({
                      ...generationSettings,
                      loraUrl: "",
                      prompt: "",
                      styleId: "custom",
                    });
                    setIsStyleDialogOpen(false);
                  }}
                  className={cn(
                    "group relative flex flex-col items-center gap-2 p-3 rounded border",
                    generationSettings.styleId === "custom"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <div className="w-full aspect-square rounded-md bg-muted flex items-center justify-center">
                    <Plus className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium">Custom</span>
                </button>

                {/* Predefined styles */}
                {styleModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setGenerationSettings({
                        ...generationSettings,
                        loraUrl: model.loraUrl || "",
                        prompt: model.prompt,
                        styleId: model.id,
                      });
                      setIsStyleDialogOpen(false);
                    }}
                    className={cn(
                      "group relative flex flex-col items-center gap-2 p-3 rounded border",
                      generationSettings.styleId === model.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className="relative w-full aspect-square rounded-md overflow-hidden">
                      <img
                        src={model.imageSrc}
                        alt={model.name}
                        width={200}
                        height={200}
                        className="w-full h-full object-cover"
                      />
                      {generationSettings.styleId === model.id && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"></div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-center">
                      {model.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
