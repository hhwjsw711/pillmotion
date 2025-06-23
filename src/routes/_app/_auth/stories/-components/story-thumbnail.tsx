import { Clapperboard, Loader2 } from "lucide-react";
import { cn } from "@/utils/misc";
import React from "react";
import { useTranslation } from "react-i18next";

interface StoryThumbnailProps {
  thumbnailUrl: string | null | undefined;
  className?: string;
}

export function StoryThumbnail({
  thumbnailUrl,
  className,
}: StoryThumbnailProps) {
  const { t } = useTranslation();
  const [isImageLoading, setIsImageLoading] = React.useState(true);
  const [imageError, setImageError] = React.useState(false);

  // Reset states when thumbnailUrl changes
  React.useEffect(() => {
    setIsImageLoading(true);
    setImageError(false);
  }, [thumbnailUrl]);

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden bg-secondary",
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