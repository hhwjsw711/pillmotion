import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Loader2, UploadCloud } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ImageUploaderProps {
  segmentId: Id<"segments">;
  onUploadComplete?: () => void;
}

export function ImageUploader({
  segmentId,
  onUploadComplete,
}: ImageUploaderProps) {
  const { t } = useTranslation();
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
        toast.error(t("toastUploadProcessingFailed"));
        console.error(err);
      },
    },
  );

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("toastFileTooLarge"));
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
      toast.error(t("toastUploadFailed"));
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
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/50"
      }`}
    >
      <input {...getInputProps()} />
      {isProcessing ? (
        <div className="flex flex-col items-center justify-center h-full">
          <Loader2 className="h-8 w-8 text-muted-foreground mb-2 animate-spin" />
          <p className="text-sm text-muted-foreground">{t("uploaderUploading")}</p>
        </div>
      ) : (
        <>
          <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {isDragActive ? t("uploaderDropHere") : t("uploaderDragDrop")}
          </p>
        </>
      )}
    </div>
  );
}
