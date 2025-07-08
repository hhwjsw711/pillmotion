import * as React from "react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { Button } from "@/ui/button";
import { useImageUpload } from "@/hooks/useImageUpload";
import { cn } from "@/utils/misc";
import { LayoutDashboard, ImagePlus, Loader2 } from "lucide-react";
import { useRef } from "react";
import { Route as DecorateIndexRoute } from "@/routes/_app/_auth/decorate/index";

interface Props {}

export const BottomNav: React.FC<Props> = ({}) => {
  const matchRoute = useMatchRoute();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const { mutate: handleUpload, isPending: isUploading } = useImageUpload();

  const isDecorateRoute = matchRoute({ to: DecorateIndexRoute.fullPath });

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
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[var(--color-border)] shadow-lg flex md:hidden justify-around py-2 px-4">
      <Button asChild variant="ghost" size={null}>
        <Link
          to={DecorateIndexRoute.to}
          className={cn(
            "flex h-full flex-col items-center justify-center text-xs font-medium",
            isDecorateRoute ? "text-blue-600" : "text-gray-500",
          )}
        >
          <LayoutDashboard className="w-6 h-6 mb-1" />
          <span>Dashboard</span>
        </Link>
      </Button>
      <Button
        variant="ghost"
        size={null}
        className="flex h-full flex-col items-center justify-center text-xs font-medium text-gray-500"
        onClick={handleUploadButtonClick}
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader2 className="w-6 h-6 mb-1 animate-spin" />
        ) : (
          <ImagePlus className="w-6 h-6 mb-1" />
        )}
        <span>{isUploading ? "Uploading..." : "Upload"}</span>
      </Button>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />
    </nav>
  );
};
