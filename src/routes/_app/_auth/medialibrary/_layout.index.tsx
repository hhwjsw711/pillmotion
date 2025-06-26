import { createFileRoute } from "@tanstack/react-router";
import { api } from "~/convex/_generated/api";
import { useUploadFile } from "@convex-dev/r2/react";
import { Upload } from "lucide-react";
import { Button } from "@/ui/button";
import { useMutation, useQuery } from "convex/react";
import { useDebouncedCallback } from "use-debounce";
import { Id } from "~/convex/_generated/dataModel";
import { MediaCard } from "./-components/MediaCard";
import { MediaCardSkeleton } from "./-components/MediaCardSkeleton";
import { Input } from "@/ui/input";
import { useMemo, useState } from "react";
import { MediaViewer } from "./-components/MediaViewer";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_app/_auth/medialibrary/_layout/")({
  component: MediaLibraryPage,
});

export default function MediaLibraryPage() {
  const { t } = useTranslation();
  const uploadFile = useUploadFile(api.r2);
  const updateMediaCaption = useMutation(
    api.r2.updateMediaCaption,
  ).withOptimisticUpdate((localStore, args) => {
    const mediaItems = localStore.getQuery(api.r2.listMedia);
    const mediaItem = mediaItems?.find((item) => item._id === args.id);
    if (mediaItem) {
      mediaItem.caption = args.caption;
    }
  });
  const deleteMediaObject = useMutation(api.r2.deleteObject);

  const mediaItems = useQuery(api.r2.listMedia, {});

  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "image" | "video" | "audio">(
    "all",
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const filteredMediaItems = useMemo(() => {
    if (mediaItems === undefined) return undefined;

    return mediaItems
      .filter((item) => {
        if (filter === "all") return true;
        return item.contentType?.startsWith(`${filter}/`);
      })
      .filter((item) => {
        if (searchTerm.trim() === "") return true;
        const searchLower = searchTerm.trim().toLowerCase();
        const caption = item.caption?.toLowerCase() ?? "";
        const filename = item.key.split("/").pop()?.toLowerCase() ?? "";
        return caption.includes(searchLower) || filename.includes(searchLower);
      });
  }, [mediaItems, filter, searchTerm]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    event.preventDefault();
    if (!event.target.files) return;
    for (const file of Array.from(event.target.files)) {
      await uploadFile(file);
    }
    // Reset the file input so the same file can be uploaded again
    event.target.value = "";
  }

  const debouncedUpdateMediaCaption = useDebouncedCallback(
    (id: Id<"media">, caption: string) => {
      void updateMediaCaption({ id, caption });
    },
    100,
    {
      maxWait: 100,
    },
  );

  const handleNext = () => {
    if (selectedIndex === null || !filteredMediaItems) return;
    if (selectedIndex < filteredMediaItems.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (selectedIndex === null || !filteredMediaItems) return;
    if (selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl flex-col gap-8">
        <div className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6 dark:bg-black">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">{t("mediaGallery.title")}</h1>
            <p className="text-sm text-primary/60">
              {t("mediaGallery.description")}
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Input
              placeholder={t("mediaGallery.searchPlaceholder")}
              className="flex-grow"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button
                variant={filter === "all" ? "secondary" : "ghost"}
                onClick={() => setFilter("all")}
                size="sm"
              >
                {t("mediaGallery.filters.all")}
              </Button>
              <Button
                variant={filter === "image" ? "secondary" : "ghost"}
                onClick={() => setFilter("image")}
                size="sm"
              >
                {t("mediaGallery.filters.image")}
              </Button>
              <Button
                variant={filter === "video" ? "secondary" : "ghost"}
                onClick={() => setFilter("video")}
                size="sm"
              >
                {t("mediaGallery.filters.video")}
              </Button>
              <Button
                variant={filter === "audio" ? "secondary" : "ghost"}
                onClick={() => setFilter("audio")}
                size="sm"
              >
                {t("mediaGallery.filters.audio")}
              </Button>
            </div>
            <Button variant="outline" className="gap-2" asChild>
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload size={16} />
                {t("mediaGallery.buttons.upload")}
              </label>
            </Button>
            <input
              id="file-upload"
              type="file"
              accept="image/*,video/*,audio/*"
              onChange={handleUpload}
              className="hidden"
              multiple
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredMediaItems === undefined ? (
              Array.from({ length: 8 }).map((_, i) => (
                <MediaCardSkeleton key={i} />
              ))
            ) : filteredMediaItems.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                {mediaItems && mediaItems.length > 0 ? (
                  <>
                    <p className="text-lg font-medium">
                      {t("mediaGallery.noResults.title")}
                    </p>
                    <p className="mt-2 text-sm">
                      {t("mediaGallery.noResults.description")}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium">
                      {t("mediaGallery.empty.title")}
                    </p>
                    <p className="mt-2 text-sm">
                      {t("mediaGallery.empty.description")}
                    </p>
                  </>
                )}
              </div>
            ) : (
              filteredMediaItems.map((item, index) => (
                <MediaCard
                  key={item._id}
                  mediaItem={item}
                  onClick={() => setSelectedIndex(index)}
                  onDelete={(key) => void deleteMediaObject({ key })}
                  onUpdateCaption={(id, caption) =>
                    debouncedUpdateMediaCaption(id, caption)
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>
      {selectedIndex !== null && filteredMediaItems?.[selectedIndex] && (
        <MediaViewer
          mediaItem={filteredMediaItems[selectedIndex]}
          onClose={() => setSelectedIndex(null)}
          onNext={handleNext}
          onPrevious={handlePrevious}
          hasNext={
            filteredMediaItems
              ? selectedIndex < filteredMediaItems.length - 1
              : false
          }
          hasPrevious={selectedIndex > 0}
        />
      )}
    </div>
  );
}
