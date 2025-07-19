import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@cvx/_generated/api";
import { useImageUpload } from "@/hooks/useImageUpload";
import { UploadCard } from "./-components/UploadCard";
import { ImageGrid } from "./-components/ImageGrid";
import { useQuery } from "convex/react";

export const Route = createFileRoute("/_app/_auth/image-editing/")({
  component: ImageEditing,
});

export default function ImageEditing() {
  const images = useQuery(api.images.listImages);
  const isLoading = images === undefined;
  const [isDragging, setIsDragging] = useState(false);
  const handleUpload = useImageUpload();

  return (
    <div className="max-w-6xl p-4 md:p-8 mx-auto w-full space-y-10">
      <UploadCard
        onUpload={handleUpload}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
      />
      <ImageGrid images={images || []} loading={isLoading} />
    </div>
  );
}
