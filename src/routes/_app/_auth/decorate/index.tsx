import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "~/convex/_generated/api";
import { useImageUpload } from "@/hooks/useImageUpload";
import { UploadCard } from "./-components/UploadCard";
import { ImageGrid } from "./-components/ImageGrid";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";

export const Route = createFileRoute("/_app/_auth/decorate/")({
  component: DecoratePage,
});

export default function DecoratePage() {
  const imagesQuery = convexQuery(api.images.listImages, {});
  const { data: images, isLoading } = useQuery(imagesQuery);
  const [isDragging, setIsDragging] = useState(false);
  const { mutate: handleUpload, isPending: isUploading } = useImageUpload();

  return (
    <div className="max-w-6xl p-4 md:p-8 mx-auto w-full space-y-10">
      <UploadCard
        onUpload={handleUpload}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        isUploading={isUploading}
      />
      <ImageGrid images={images || []} loading={isLoading} />
    </div>
  );
}
