import { useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Clapperboard, Loader2 } from "lucide-react";
import { cn } from "@/utils/misc";
import React from "react";
import { useTranslation } from "react-i18next";

interface StoryThumbnailProps {
  storyId: Id<"story">;
  className?: string;
}

export function StoryThumbnail({ storyId, className }: StoryThumbnailProps) {
  const { t } = useTranslation();
  const segments = useQuery(api.segments.getByStory, { storyId });
  const firstSegment = segments?.[0];
  const thumbnailUrl = useQuery(
    api.files.getFileUrl,
    firstSegment?.selectedVersion?.previewImage
      ? { storageId: firstSegment.selectedVersion.previewImage }
      : "skip",
  );

  const [isImageLoading, setIsImageLoading] = React.useState(true);
  const [imageError, setImageError] = React.useState(false);

  return (
    <div
      className={cn(
        "aspect-video w-full overflow-hidden bg-secondary",
        className,
      )}
    >
      {thumbnailUrl && !imageError ? (
        <>
          {isImageLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
            </div>
          )}
          <img
            src={thumbnailUrl}
            alt={t("storyThumbnailAlt")}
            className={cn(
              "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
              isImageLoading && "opacity-0",
            )}
            loading="lazy"
            onLoad={() => setIsImageLoading(false)}
            onError={() => {
              setImageError(true);
              setIsImageLoading(false);
            }}
          />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Clapperboard className="h-12 w-12 text-primary/40" />
        </div>
      )}
    </div>
  );
}
