import {
  X,
  ChevronLeft,
  ChevronRight,
  FileImage,
  FileAudio,
} from "lucide-react";
import { api } from "~/convex/_generated/api";
import { useEffect } from "react";
import { Button } from "@/ui/button";
import { useTranslation } from "react-i18next";

type MediaItem = (typeof api.r2.listMedia._returnType)[number];

function getMediaTypeFromContentType(
  contentType: string | null | undefined,
): "image" | "video" | "audio" | "unknown" {
  if (!contentType) return "unknown";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  return "unknown";
}

export const MediaViewer = ({
  mediaItem,
  onClose,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
}: {
  mediaItem: MediaItem;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
}) => {
  const mediaType = getMediaTypeFromContentType(mediaItem.contentType);
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && hasNext) onNext();
      if (e.key === "ArrowLeft" && hasPrevious) onPrevious();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNext, onPrevious, hasNext, hasPrevious]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative flex h-full w-full max-w-4xl items-center justify-center">
        {/* Content */}
        <div className="flex h-full max-h-[80vh] w-full items-center justify-center">
          {mediaType === "image" && mediaItem.url && (
            <img
              src={mediaItem.url}
              alt={mediaItem.caption || "Media"}
              className="max-h-full max-w-full object-contain"
            />
          )}
          {mediaType === "video" && mediaItem.url && (
            <video
              src={mediaItem.url}
              controls
              autoPlay
              className="max-h-full max-w-full"
            >
              Your browser does not support the video tag.
            </video>
          )}
          {mediaType === "audio" && mediaItem.url && (
            <div className="flex flex-col items-center gap-4 rounded-lg bg-card p-8">
              <FileAudio className="h-24 w-24 text-muted-foreground" />
              <p className="text-lg">{mediaItem.key.split("/").pop()}</p>
              <audio src={mediaItem.url} controls autoPlay className="w-full">
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
          {mediaType === "unknown" && (
            <div className="flex flex-col items-center gap-4 rounded-lg bg-card p-8">
              <FileImage className="h-24 w-24 text-muted-foreground" />
              <p className="text-lg">{mediaItem.key.split("/").pop()}</p>
            </div>
          )}
        </div>

        {/* Caption */}
        {mediaItem.caption && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-sm text-white">
            {mediaItem.caption}
          </div>
        )}
      </div>

      {/* Controls */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 rounded-full text-white hover:bg-white/20 hover:text-white"
        onClick={onClose}
        aria-label={t("mediaGallery.viewer.closeAriaLabel")}
      >
        <X size={24} />
      </Button>
      {hasPrevious && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full text-white hover:bg-white/20 hover:text-white"
          onClick={onPrevious}
          aria-label={t("mediaGallery.viewer.previousAriaLabel")}
        >
          <ChevronLeft size={32} />
        </Button>
      )}
      {hasNext && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full text-white hover:bg-white/20 hover:text-white"
          onClick={onNext}
          aria-label={t("mediaGallery.viewer.nextAriaLabel")}
        >
          <ChevronRight size={32} />
        </Button>
      )}
    </div>
  );
};
