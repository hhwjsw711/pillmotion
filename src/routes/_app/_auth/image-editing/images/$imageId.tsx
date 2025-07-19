import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { PromptPanel } from "./-components/PromptPanel";
import { ImageDisplay } from "./-components/ImageDisplay";

export const Route = createFileRoute('/_app/_auth/image-editing/images/$imageId')({
  component: ImagePage
})

export default function ImagePage() {
  const { imageId } = Route.useParams();

  const image = useQuery(api.images.getImage, {
    imageId: imageId as Id<"images">,
  });

  return (
    <div className="relative flex flex-col-reverse md:flex-row flex-1 w-full bg-background">
      {image && <PromptPanel image={image} />}
      {image && <ImageDisplay imageId={imageId as Id<"images">} status={image.status} />}
    </div>
  );
}
