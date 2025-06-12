import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Loader2, UploadCloud } from "lucide-react";

interface ImageUploaderProps {
  segmentId: Id<"segments">;
  onUploadComplete?: () => void;
}

export function ImageUploader({
  segmentId,
  onUploadComplete,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const generateUploadUrl = useConvexMutation(api.files.generateUploadUrl);

  const { mutateAsync: startUpload, isPending: isStartingUpload } = useMutation(
    {
      mutationFn: useConvexMutation(
        api.imageVersions.startUploadAndSelectVersion,
      ),
      onSuccess: () => {
        onUploadComplete?.();
      },
      onError: (err) => {
        toast.error("Failed to start processing. Please try again.");
        console.error(err);
      },
    },
  );

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Please upload an image under 5MB.");
      return;
    }

    setIsUploading(true);

    try {
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();

      await startUpload({
        segmentId,
        uploadedImageId: storageId,
      });
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed. Please check the console for details.");
    } finally {
      setIsUploading(false);
    }
  };

  const isProcessing = isUploading || isStartingUpload;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
    disabled: isProcessing,
  });

  return (
    <div
      {...getRootProps()}
      className={`p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors text-center ${
        isDragActive
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
          : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
      }`}
    >
      <input {...getInputProps()} />
      {isProcessing ? (
        <div className="flex flex-col items-center justify-center h-full">
          <Loader2 className="h-8 w-8 text-gray-400 mb-2 animate-spin" />
          <p className="text-sm text-muted-foreground">Uploading...</p>
        </div>
      ) : (
        <>
          <UploadCloud className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-muted-foreground">
            {isDragActive
              ? "Drop the image here"
              : "Drag & drop or click to upload"}
          </p>
          <p className="text-xs text-muted-foreground">Max 5MB</p>
        </>
      )}
    </div>
  );
}
