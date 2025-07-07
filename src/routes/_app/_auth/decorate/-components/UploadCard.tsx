import { Card } from "@/ui/card";
import React from "react";
import { isMobile } from "@/utils/misc";
import { Loader2 } from "lucide-react";

interface UploadCardProps {
  onUpload: (file: File) => void;
  isDragging: boolean;
  setIsDragging: (drag: boolean) => void;
  isUploading?: boolean;
}

export function UploadCard({
  onUpload,
  isDragging,
  setIsDragging,
  isUploading,
}: UploadCardProps) {
  const mobile = isMobile();

  return (
    <Card
      className={`relative border-2 border-dashed p-10 text-center transition-colors flex flex-col items-center justify-center mb-8 ${
        isDragging && !isUploading
          ? "border-blue-400 bg-blue-50"
          : "border-[var(--color-border)] bg-white"
      }`}
      onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
        if (isUploading) return;
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => {
        if (isUploading) return;
        setIsDragging(false);
      }}
      onDrop={(e: React.DragEvent<HTMLDivElement>) => {
        if (isUploading) return;
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) onUpload(file);
      }}
    >
      {isUploading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-lg z-10">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
          <p className="mt-4 text-lg font-semibold text-slate-800">
            Uploading...
          </p>
        </div>
      )}
      <div className="flex flex-col items-center gap-4">
        <div className="text-5xl text-blue-400 mb-2">📸</div>
        <div>
          <p className="text-2xl font-bold text-slate-800 mb-1">
            Upload your image
          </p>
          <p className="text-base text-gray-500 mb-2">
            {mobile
              ? "Choose from gallery or take a photo"
              : "Drag & drop or select a file to get started"}
          </p>
          <div className={`mt-2 ${mobile ? "flex flex-col gap-2" : ""}`}>
            {/* Gallery/File picker */}
            <label className="inline-block">
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple={false}
                disabled={isUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  onUpload(file);
                }}
              />
              <span
                className={`button px-6 py-2 ${
                  isUploading
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
                Select a file
              </span>
            </label>
          </div>
        </div>
      </div>
    </Card>
  );
}
