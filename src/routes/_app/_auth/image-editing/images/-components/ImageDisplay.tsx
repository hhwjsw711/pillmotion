import { Id } from "@cvx/_generated/dataModel";
import { UploadingImage } from "./UploadingImage";
import { UploadedImage } from "./UploadedImage";
import { GeneratingImage } from "./GeneratingImage";
import { GeneratedImage } from "./GeneratedImage";
import type { GenerationSettings } from "@/types/canvas";

interface ImageDisplayProps {
  imageId: Id<"images">;
  status: {
    kind: "uploading" | "uploaded" | "generating" | "generated";
    image?: { url: string };
    decoratedImage?: { url: string };
    generationSettings?: GenerationSettings;
  };
}

export function ImageDisplay({ imageId, status }: ImageDisplayProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br min-h-[320px] relative overflow-hidden">
      <div className="flex flex-col items-center justify-center w-full h-full p-4 md:p-8">
        {status.kind === "uploading" && <UploadingImage imageId={imageId} />}

        {status.kind === "uploaded" && status.image && (
          <UploadedImage imageUrl={status.image.url} />
        )}

        {status.kind === "generating" && status.image && status.generationSettings && (
          <GeneratingImage imageUrl={status.image.url} prompt={status.generationSettings.prompt} />
        )}

        {status.kind === "generated" &&
          status.image &&
          status.decoratedImage &&
          status.generationSettings && (
            <GeneratedImage
              originalImageUrl={status.image.url}
              decoratedImageUrl={status.decoratedImage.url}
              prompt={status.generationSettings.prompt}
            />
          )}
      </div>
    </div>
  );
}
