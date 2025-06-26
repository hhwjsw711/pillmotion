import { createFileRoute } from "@tanstack/react-router";
import { api } from "~/convex/_generated/api";
import { useUploadFile } from "@convex-dev/r2/react";
import { Upload } from "lucide-react";
import { Button } from "@/ui/button";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useDebouncedCallback } from "use-debounce";
import { Id } from "~/convex/_generated/dataModel";
import { MetadataTable } from "./-components/MetadataTable";
import { MediaCard } from "./-components/MediaCard";

export const Route = createFileRoute("/_app/_auth/medialibrary/_layout/")({
  component: MediaLibraryPage,
});

export default function MediaLibraryPage() {
  const uploadFile = useUploadFile(api.r2);
  const updateMediaCaption = useMutation(
    api.r2.updateMediaCaption,
  ).withOptimisticUpdate((localStore, args) => {
    // A small optimistic update function to synchronously update the UI while
    // the mutation is pending.
    const mediaItems = localStore.getQuery(api.r2.listMedia);
    const mediaItem = mediaItems?.find((item) => item._id === args.id);
    if (mediaItem) {
      mediaItem.caption = args.caption;
    }
  });
  const deleteMediaObject = useMutation(api.r2.deleteObject);

  // Get media from your app's own `media` table
  const mediaItems = useQuery(api.r2.listMedia, {});

  // Get metadata from the R2 component's `metadata` table
  const metadata = usePaginatedQuery(
    api.r2.listMetadata,
    {},
    { initialNumItems: 20 },
  );
  console.log("metadata", metadata.results.length);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    event.preventDefault();
    // `uploadFile` returns the key of the uploaded file, which you can use to
    // query that specific image
    const key = await uploadFile(event.target.files![0]);
    console.log("Uploaded file with key:", key);
  }

  // Debounce the updateMediaCaption mutation to avoid blocking input changes.
  const debouncedUpdateMediaCaption = useDebouncedCallback(
    (id: Id<"media">, caption: string) => {
      void updateMediaCaption({ id, caption });
    },
    100,
    {
      maxWait: 100,
    },
  );

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl flex-col gap-8">
        <div className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6 dark:bg-black">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">Media Gallery</h1>
            <p className="text-sm text-primary/60">
              Upload and manage your files here.
            </p>
          </div>

          <div className="mb-4 flex gap-2">
            <Button variant="outline" className="gap-2" asChild>
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload size={20} />
                Upload File
              </label>
            </Button>
            <input
              id="file-upload"
              type="file"
              accept="image/*,video/*,audio/*"
              onChange={handleUpload}
              className="hidden"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {mediaItems?.map((item) => (
              <MediaCard
                key={item._id}
                mediaItem={item}
                onDelete={(key) => void deleteMediaObject({ key })}
                onUpdateCaption={(id, caption) =>
                  debouncedUpdateMediaCaption(id, caption)
                }
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6 dark:bg-black">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">R2 Admin</h1>
            <p className="text-sm text-primary/60">
              Browse R2 bucket metadata.
            </p>
          </div>
          <div className="mb-4">
            <MetadataTable data={metadata.results ?? []} />
            {metadata.status === "CanLoadMore" && (
              <Button variant="outline" onClick={() => metadata.loadMore(10)}>
                Load More
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
