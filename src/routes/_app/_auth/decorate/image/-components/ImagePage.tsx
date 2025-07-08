import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { PromptPanel } from "./PromptPanel";
import { ImageDisplay } from "./ImageDisplay";
import { Skeleton } from "@/ui/skeleton";

interface ImagePageProps {
  imageId: Id<"images">;
}

export default function ImagePage({ imageId }: ImagePageProps) {
  const imageQuery = convexQuery(api.images.getImage, { imageId });
  const { data: image, isLoading } = useQuery(imageQuery);

  if (isLoading) {
    return (
      <div className="relative flex flex-col-reverse md:flex-row flex-1 w-full bg-[var(--color-bg)]">
        {/* Skeleton for PromptPanel */}
        <div className="w-full md:w-96 bg-white p-6 shadow-lg z-10 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        {/* Skeleton for ImageDisplay */}
        <div className="flex-1 flex items-center justify-center bg-gray-100">
          <Skeleton className="h-[80%] w-[80%] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col-reverse md:flex-row flex-1 w-full bg-[var(--color-bg)]">
      {image && <PromptPanel image={image} />}
      {image && <ImageDisplay imageId={imageId} status={image.status} />}
    </div>
  );
}
