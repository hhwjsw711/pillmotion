import { useMediaLibrary, useMediaLibraryStore } from "@/hooks/useMediaLibrary";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Spinner } from "@/ui/spinner";
import { AlertTriangle, Video, ImageIcon, X } from "lucide-react";
import { SearchResult } from "@/hooks/useMediaLibrary";
import { Button } from "@/ui/button";
import { useState } from "react";
import { cn } from "@/utils/misc";
import { useTranslation } from "react-i18next";

// Helper function to extract prompt regardless of type
const getPrompt = (result: SearchResult): string | undefined => {
  if (result.resultType === "image") {
    return result.prompt;
  }
  // This correctly handles all video context types
  if (
    result.context.type === "image_to_video" ||
    result.context.type === "text_to_video"
  ) {
    return result.context.prompt;
  }
  return undefined;
};

// [REFACTORED] The modal is now fully self-contained and takes no props.
export const MediaLibraryModal = () => {
  const { t } = useTranslation();
  // It gets ALL its state and callbacks from the global store.
  const { isOpen, close: closeStore, onSelect } = useMediaLibraryStore();
  const { searchTerm, setSearchTerm, results, isLoading, error } =
    useMediaLibrary();

  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(
    null,
  );

  // This function now correctly calls the `onSelect` callback from the store.
  const handleSelectAndClose = (result: SearchResult) => {
    onSelect(result);
    closeStore();
    setSelectedResult(null);
  };

  const handleClose = () => {
    closeStore();
    setSelectedResult(null); // Also clear local selection on close
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>{t("mediaLibraryTitle")}</DialogTitle>
        </DialogHeader>
        <div className="relative p-4 border-b">
          <Input
            placeholder={t("mediaLibrarySearchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-lg pr-10"
          />
          {isLoading && (
            <div className="absolute inset-y-0 right-6 flex items-center">
              <Spinner />
            </div>
          )}
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <Content
              isLoading={isLoading}
              error={error}
              results={results}
              searchTerm={searchTerm}
              selectedResult={selectedResult}
              onSelect={setSelectedResult}
            />
          </div>
          {selectedResult && (
            <div className="w-1/2 border-l flex flex-col">
              <DetailView
                result={selectedResult}
                onClose={() => setSelectedResult(null)}
                onConfirm={handleSelectAndClose}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// --- Child Components (Unchanged) ---

interface ContentProps {
  isLoading: boolean;
  error: string | null;
  results: SearchResult[];
  searchTerm: string;
  selectedResult: SearchResult | null;
  onSelect: (result: SearchResult) => void;
}

const Content = ({
  isLoading,
  error,
  results,
  searchTerm,
  selectedResult,
  onSelect,
}: ContentProps) => {
  const { t } = useTranslation();

  if (isLoading && results.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <p className="text-lg font-semibold">{error}</p>
      </div>
    );
  }

  if (results.length > 0) {
    return (
      <SearchResultsGrid
        results={results}
        selectedResult={selectedResult}
        onSelect={onSelect}
      />
    );
  }

  if (searchTerm) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>{t("mediaLibraryNoResults", { searchTerm })}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full text-center text-muted-foreground">
      <div>
        <p className="font-semibold">{t("mediaLibraryReadyTitle")}</p>
        <p className="text-sm">{t("mediaLibraryReadyDescription")}</p>
      </div>
    </div>
  );
};

interface SearchResultsGridProps {
  results: SearchResult[];
  selectedResult: SearchResult | null;
  onSelect: (result: SearchResult) => void;
}

const SearchResultsGrid = ({
  results,
  selectedResult,
  onSelect,
}: SearchResultsGridProps) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {results.map((result) => (
      <SearchResultCard
        key={result._id}
        result={result}
        isSelected={result._id === selectedResult?._id}
        onSelect={onSelect}
      />
    ))}
  </div>
);

interface SearchResultCardProps {
  result: SearchResult;
  isSelected: boolean;
  onSelect: (result: SearchResult) => void;
}

const SearchResultCard = ({
  result,
  isSelected,
  onSelect,
}: SearchResultCardProps) => {
  const { t } = useTranslation();
  const [isHovering, setIsHovering] = useState(false);
  const isVideo = result.resultType === "video";
  const prompt = getPrompt(result);

  // A more type-safe way to access video properties
  const videoResult = isVideo
    ? (result as Extract<SearchResult, { resultType: "video" }>)
    : null;

  const thumbnailUrl = videoResult?.posterUrl ?? result.previewUrl;

  return (
    <Button
      variant="ghost"
      className={cn(
        "relative aspect-square group overflow-hidden rounded-lg border p-0 h-auto w-auto focus-visible:ring-offset-0 focus-visible:ring-2 focus-visible:ring-ring",
        isSelected && "ring-2 ring-primary ring-offset-2",
      )}
      onClick={() => onSelect(result)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* [FIX] The check is now inlined, which allows TypeScript to correctly narrow the type of `videoResult.videoUrl` to `string`. */}
      {isHovering && videoResult?.videoUrl ? (
        <video
          key={videoResult.videoUrl}
          src={videoResult.videoUrl}
          className="w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />
      ) : thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={prompt || t("mediaLibraryAssetAlt")}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          {isVideo ? (
            <Video className="w-10 h-10 text-muted-foreground" />
          ) : (
            <ImageIcon className="w-10 h-10 text-muted-foreground" />
          )}
        </div>
      )}

      {isVideo && (
        <div className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full pointer-events-none">
          <Video className="w-4 h-4" />
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end h-1/2 pointer-events-none">
        <p className="text-xs line-clamp-2 text-left">
          {prompt || t("mediaLibraryUntitled")}
        </p>
      </div>
    </Button>
  );
};

const DetailView = ({
  result,
  onClose,
  onConfirm,
}: {
  result: SearchResult;
  onClose: () => void;
  onConfirm: (result: SearchResult) => void;
}) => {
  const { t } = useTranslation();
  const prompt = getPrompt(result);
  const isVideo = result.resultType === "video";
  const videoResult = isVideo
    ? (result as Extract<SearchResult, { resultType: "video" }>)
    : null;
  const typeText = isVideo
    ? t("mediaLibraryAssetTypeVideo")
    : t("mediaLibraryAssetTypeImage");

  return (
    <>
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-lg">
          {t("mediaLibraryPreviewTitle")}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="aspect-square bg-muted rounded-lg mb-4">
          {videoResult?.videoUrl ? (
            <video
              src={videoResult.videoUrl}
              controls
              autoPlay
              className="w-full h-full object-contain rounded-lg"
            />
          ) : videoResult?.posterUrl ? (
            <img
              src={videoResult.posterUrl}
              alt={prompt || t("mediaLibraryUntitled")}
              className="w-full h-full object-contain rounded-lg"
            />
          ) : result.previewUrl ? (
            <img
              src={result.previewUrl}
              alt={prompt || t("mediaLibraryUntitled")}
              className="w-full h-full object-contain rounded-lg"
            />
          ) : null}
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold">{t("promptLabel")}</h4>
          <p className="text-sm text-muted-foreground">
            {prompt || t("mediaLibraryNoPrompt")}
          </p>
        </div>
      </div>
      <div className="p-4 border-t">
        <Button className="w-full" onClick={() => onConfirm(result)}>
          {t("mediaLibraryUseThis", { type: typeText })}
        </Button>
      </div>
    </>
  );
};
