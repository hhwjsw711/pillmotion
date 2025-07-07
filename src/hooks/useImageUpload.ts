import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Route as ImageRoute } from "@/routes/_app/_auth/decorate/image/$imageId";
import { useApiErrorHandler } from "@/hooks/useApiErrorHandler";
import { router } from "@/router";

// Module-level map for storing object URLs for uploading images
const uploadingImageObjectUrls: Record<string, string> = {};

export function setUploadingImageObjectUrl(imageId: string, objectUrl: string) {
  uploadingImageObjectUrls[imageId] = objectUrl;
}

export function getUploadingImageObjectUrl(
  imageId: string,
): string | undefined {
  return uploadingImageObjectUrls[imageId];
}

export function clearUploadingImageObjectUrl(imageId: string) {
  const url = uploadingImageObjectUrls[imageId];
  if (url) URL.revokeObjectURL(url);
  delete uploadingImageObjectUrls[imageId];
}

// Helper to resize and re-encode image as WebP (or JPEG fallback)
export async function resizeAndConvertImage(
  file: File,
  maxWidth = 2048,
  maxHeight = 2048,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      // Calculate new dimensions
      if (width > maxWidth || height > maxHeight) {
        const aspect = width / height;
        if (width > height) {
          width = maxWidth;
          height = Math.round(maxWidth / aspect);
        } else {
          height = maxHeight;
          width = Math.round(maxHeight * aspect);
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Could not get canvas context"));
      ctx.drawImage(img, 0, 0, width, height);
      // Check WebP support
      const mimeType =
        canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0
          ? "image/webp"
          : "image/jpeg";
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Failed to convert image"));
          resolve(blob);
        },
        mimeType,
        0.92, // quality
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function useImageUpload() {
  const generateUploadUrl = useConvexMutation(api.images.generateUploadUrl);
  const markUploaded = useConvexMutation(api.images.markUploaded);
  const onApiError = useApiErrorHandler();

  return useMutation({
    mutationFn: async (file: File) => {
      // Resize and re-encode before upload
      const processedBlob = await resizeAndConvertImage(file);
      const processedFile = new File(
        [processedBlob],
        file.name.replace(/\.[^.]+$/, ".webp"),
        {
          type: processedBlob.type,
        },
      );
      const { uploadUrl, imageId } = await generateUploadUrl({});

      // Store object URL for use in ImagePage (from processed blob)
      const objectUrl = URL.createObjectURL(processedBlob);
      setUploadingImageObjectUrl(imageId, objectUrl);

      try {
        // Navigate to progress page immediately
        router.navigate({
          to: ImageRoute.to,
          params: { imageId },
        });

        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": processedFile.type },
          body: processedFile,
        });
        if (!result.ok) {
          throw new Error(`Upload failed with status: ${result.status}`);
        }
        const { storageId } = await result.json();
        await markUploaded({ imageId, storageId });
        return { imageId };
      } catch (error) {
        // Explicitly clear the object URL on failure
        clearUploadingImageObjectUrl(imageId);
        throw error;
      }
    },
    onSuccess: ({ imageId }) => {
      // Clear object URL after upload is complete
      clearUploadingImageObjectUrl(imageId);
      toast.success("Image uploaded successfully!");
    },
    onError: (error) => {
      onApiError(error);
    },
  });
}
