import * as React from "react";
import { Button } from "./Button";
import { cn } from "@/utils/misc";
import { useImageUpload } from "@/hooks/useImageUpload";
import { LayoutDashboard, ImagePlus } from "lucide-react";
import { useRef } from "react";
import { Route as ImageRoute } from "@/routes/_app/_auth/image-editing/images/$imageId";
import { Route as ImageEditingRoute } from "@/routes/_app/_auth/image-editing/index";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";

export const BottomNav: React.FC = () => {
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const isImageEditingPath = matchRoute({ to: ImageEditingRoute.fullPath });
  const isImageRoute = matchRoute({ to: ImageRoute.fullPath });
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const handleUpload = useImageUpload();
  const handleUploadButtonClick = () => {
    uploadInputRef.current?.click();
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border shadow-lg flex md:hidden justify-around py-2 px-4">
      <Button
        variant="link"
        className={cn(
          "flex flex-col items-center text-xs font-medium",
          isImageEditingPath ? "text-accent" : "text-gray-400",
        )}
        onClick={() => navigate({ to: ImageEditingRoute.fullPath })}
      >
        <LayoutDashboard className="w-6 h-6 mb-1" />
        <span>Dashboard</span>
      </Button>
      <Button
        variant="link"
        className={cn(
          "flex flex-col items-center text-xs font-medium",
          isImageRoute ? "text-accent" : "text-gray-400",
        )}
        onClick={handleUploadButtonClick}
      >
        <ImagePlus className="w-6 h-6 mb-1" />
        <span>Upload</span>
      </Button>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </nav>
  );
};
