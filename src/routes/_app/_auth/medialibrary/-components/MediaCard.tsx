import { api } from "~/convex/_generated/api";
import { X, FileImage } from "lucide-react";
import { Input } from "@/ui/input";
import { Id } from "~/convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";

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
}: {
  mediaItem: (typeof api.r2.listMedia._returnType)[number];
  onDelete: (key: string) => void;
  onUpdateCaption: (id: Id<"media">, caption: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState(mediaItem.caption ?? "");
  const mediaType = getMediaTypeFromContentType(mediaItem.contentType);

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
      <div className="group relative">
        {mediaType === "image" && mediaItem.url && (
          <img
            src={mediaItem.url}
            alt={caption || "Gallery media"}
            className="h-56 w-full object-cover"
          />
        )}
        {mediaType === "video" && mediaItem.url && (
          <video
            src={mediaItem.url}
            controls
            className="h-56 w-full object-cover"
          >
            Your browser does not support the video tag.
          </video>
        )}
        {mediaType === "audio" && mediaItem.url && (
          <div className="flex h-56 w-full items-center justify-center bg-secondary p-4">
            <audio src={mediaItem.url} controls className="w-full">
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
        {mediaType === "unknown" && (
          <div className="flex h-56 w-full items-center justify-center bg-secondary">
            <FileImage className="h-16 w-16 text-muted-foreground" />
          </div>
        )}

        <button
          onClick={() => onDelete(mediaItem.key)}
          className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity hover:bg-destructive/90 group-hover:opacity-100"
          aria-label="Delete media"
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
          placeholder="Add a caption"
          className="w-full border-none bg-transparent text-sm focus:outline-none focus:ring-0"
          aria-label="Media caption"
        />
      </div>
    </div>
  );
};
