import { api } from "~/convex/_generated/api";
import { X, FileImage, PlayCircle, FileAudio } from "lucide-react";
import { Input } from "@/ui/input";
import { Id } from "~/convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

function getMediaTypeFromContentType(
  contentType: string | null | undefined,
): "image" | "video" | "audio" | "unknown" {
  if (!contentType) return "unknown";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  return "unknown";
}

export const MediaCard = ({
  mediaItem,
  onDelete,
  onUpdateCaption,
  onClick,
}: {
  mediaItem: (typeof api.r2.listMedia._returnType)[number];
  onDelete: (key: string) => void;
  onUpdateCaption: (id: Id<"media">, caption: string) => void;
  onClick: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState(mediaItem.caption ?? "");
  const mediaType = getMediaTypeFromContentType(mediaItem.contentType);
  const { t } = useTranslation();

  // This effect ensures that if the parent data changes, the local state is updated,
  // but it won't overwrite what the user is currently typing.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setCaption(mediaItem.caption ?? "");
    }
  }, [mediaItem.caption]);

  const handleSaveCaption = () => {
    if (caption !== mediaItem.caption) {
      onUpdateCaption(mediaItem._id, caption);
    }
  };

  return (
    <div
      key={mediaItem._id}
      className="flex flex-col overflow-hidden rounded-lg border"
    >
      <div className="group relative cursor-pointer" onClick={onClick}>
        {mediaType === "image" && mediaItem.url && (
          <img
            src={mediaItem.url}
            alt={caption || "Gallery media"}
            className="h-56 w-full object-cover"
          />
        )}
        {mediaType === "video" && mediaItem.url && (
          <>
            <video
              src={`${mediaItem.url}#t=0.1`}
              muted
              preload="metadata"
              className="h-56 w-full bg-black object-cover"
            >
              Your browser does not support the video tag.
            </video>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
              <PlayCircle className="h-12 w-12 text-white/80" />
            </div>
          </>
        )}
        {mediaType === "audio" && (
          <div className="flex h-56 w-full flex-col items-center justify-center bg-secondary p-4">
            <FileAudio className="h-16 w-16 text-muted-foreground" />
            <p className="mt-2 w-full truncate px-2 text-center text-sm text-muted-foreground">
              {mediaItem.key.split("/").pop()}
            </p>
          </div>
        )}
        {mediaType === "unknown" && (
          <div className="flex h-56 w-full items-center justify-center bg-secondary">
            <FileImage className="h-16 w-16 text-muted-foreground" />
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent opening viewer when deleting
            onDelete(mediaItem.key);
          }}
          className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity hover:bg-destructive/90 group-hover:opacity-100"
          aria-label={t("mediaGallery.card.deleteAriaLabel")}
        >
          <X size={20} />
        </button>
      </div>
      <div className="flex-grow bg-card p-2">
        <Input
          ref={inputRef}
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSaveCaption();
              inputRef.current?.blur();
            }
          }}
          onBlur={handleSaveCaption}
          placeholder={t("mediaGallery.card.captionPlaceholder")}
          className="w-full border-none bg-transparent text-sm focus:outline-none focus:ring-0"
          aria-label="Media caption"
        />
      </div>
    </div>
  );
};
