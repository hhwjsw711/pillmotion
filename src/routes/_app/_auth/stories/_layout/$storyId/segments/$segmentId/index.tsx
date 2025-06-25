import { createFileRoute, Link } from "@tanstack/react-router";
import { Id, Doc } from "~/convex/_generated/dataModel";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  Bot,
  Film,
  AlertTriangle,
  ChevronDown,
  Video,
  Clapperboard,
  Library,
  Users,
  Shuffle,
  X,
} from "lucide-react";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { cn } from "@/utils/misc";
import { MediaUploader } from "../../-components/image-uploader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { useTranslation } from "react-i18next";
import {
  useSegmentEditor,
  type ImageVersionWithSubVersions,
  type HistoryTimelineNode,
} from "@/hooks/useSegmentEditor";
import { Spinner } from "@/ui/spinner";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMediaLibraryStore } from "@/hooks/useMediaLibrary";
import { SearchResult } from "@/hooks/useMediaLibrary";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { api } from "@cvx/_generated/api";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

export const Route = createFileRoute(
  "/_app/_auth/stories/_layout/$storyId/segments/$segmentId/",
)({
  component: SegmentEditor,
});

function ImageVersionCard({
  version,
  isSelected,
  onSelect,
  isSelecting,
  onGenerateVideo,
  isGeneratingThisVideo,
  isDraggable, // [ADD]
}: {
  version: ImageVersionWithSubVersions;
  isSelected: boolean;
  onSelect: () => void;
  isSelecting: boolean;
  onGenerateVideo: () => void;
  isGeneratingThisVideo: boolean;
  isDraggable: boolean; // [ADD]
}) {
  const { t } = useTranslation();
  const { isDragging, attributes, listeners, setNodeRef } = useDraggable({
    id: version._id,
    data: {
      type: "image",
      item: version,
    },
    disabled: !isDraggable, // [ADD]
  });

  const sourceDisplayName: Record<Doc<"imageVersions">["source"], string> = {
    ai_generated: t("sourceAIGenerated"),
    ai_edited: t("sourceAIEdited"),
    user_uploaded: t("sourceUserUploaded"),
    from_library: t("sourceFromLibrary"),
    frame_extracted: t("sourceFrameExtracted", "Frame Extracted"),
  };

  return (
    <div
      ref={setNodeRef}
      style={{ visibility: isDragging ? "hidden" : "visible" }}
      className={cn(
        "rounded-lg border p-3 space-y-2 bg-card",
        isSelected && "ring-2 ring-primary",
      )}
    >
      <div
        {...listeners}
        {...attributes}
        className={cn(
          // [CHANGE] This whole className block
          "aspect-video w-full rounded bg-muted flex items-center justify-center touch-none",
          isDraggable && "cursor-grab",
        )}
      >
        {version.previewImageUrl ? (
          <img
            src={version.previewImageUrl}
            className="h-full w-full object-contain rounded"
            alt={version.prompt ?? "User uploaded image"}
          />
        ) : (
          <Clapperboard className="h-10 w-10 text-muted-foreground" />
        )}
      </div>
      {version.prompt && (
        <p className="text-xs text-muted-foreground italic line-clamp-2">
          "{version.prompt}"
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t("versionSource", { source: sourceDisplayName[version.source] })}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={isSelected ? "default" : "secondary"}
          size="sm"
          className="w-full"
          onClick={onSelect}
          disabled={isSelected || isSelecting}
        >
          {isSelecting && isSelected ? (
            <Spinner />
          ) : isSelected ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {t("versionCardCurrent")}
            </>
          ) : (
            t("versionCardSelect")
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onGenerateVideo}
          disabled={isGeneratingThisVideo}
        >
          {isGeneratingThisVideo ? (
            <Spinner />
          ) : (
            <Video className="mr-2 h-4 w-4" />
          )}
          {t("buttonGenerateVideoClip")}
        </Button>
      </div>
    </div>
  );
}

function VideoClipCard({
  clip,
  isSelected,
  onSelect,
  isSelecting,
  isDraggable, // [ADD]
}: {
  clip: Doc<"videoClipVersions"> & {
    videoUrl: string | null;
    posterUrl: string | null;
    lastFramePosterUrl: string | null;
  };
  isSelected: boolean;
  onSelect: () => void;
  isSelecting: boolean;
  isDraggable: boolean; // [ADD]
}) {
  const { isDragging, attributes, listeners, setNodeRef } = useDraggable({
    id: clip._id,
    data: {
      type: "video",
      item: clip,
    },
    disabled: !isDraggable, // [ADD]
  });
  const { t } = useTranslation();
  const [isHovering, setIsHovering] = useState(false);
  const isError = clip.generationStatus === "error";
  const isGenerating = clip.generationStatus === "generating";

  return (
    <div
      ref={setNodeRef}
      style={{ visibility: isDragging ? "hidden" : "visible" }}
      className={cn(
        "p-2 rounded-lg border bg-background/50 flex items-center justify-between gap-2",
        isSelected && "ring-1 ring-primary/80",
        isError && "border-destructive/50 bg-destructive/10",
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          {...listeners}
          {...attributes}
          className={cn(
            // [CHANGE] This whole className block
            "w-20 h-12 bg-muted rounded flex-shrink-0 flex items-center justify-center touch-none",
            isDraggable && "cursor-grab",
          )}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {isHovering && clip.videoUrl ? (
            <video
              src={clip.videoUrl}
              className="w-full h-full object-contain rounded"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : clip.posterUrl ? (
            <img
              src={clip.posterUrl}
              alt={t("videoClipTitle")}
              className="w-full h-full object-contain rounded"
            />
          ) : isGenerating ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : isError ? (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          ) : (
            <Film className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="text-xs flex-1 min-w-0">
          <p className="font-semibold truncate">
            {isGenerating
              ? t("videoClipGenInProgress")
              : isError
                ? t("videoClipGenFailed")
                : t("videoClipTitle")}
          </p>
          {isError && clip.statusMessage && (
            <p className="text-destructive/80 truncate">{clip.statusMessage}</p>
          )}
        </div>
      </div>
      {!isError && !isGenerating && (
        <Button
          variant={isSelected ? "default" : "secondary"}
          size="xs"
          onClick={onSelect}
          disabled={isSelected || isSelecting}
        >
          {isSelected ? t("versionCardCurrent") : t("versionCardSelect")}
        </Button>
      )}
    </div>
  );
}

function ImageVersionNode({
  version,
  isImageSelected,
  selectedVideoClipId,
  onSelectImage,
  onSelectVideo,
  isSelecting,
  onGenerateVideo,
  isGeneratingThisVideo,
  isDraggable, // [ADD]
}: {
  version: ImageVersionWithSubVersions;
  isImageSelected: boolean;
  selectedVideoClipId?: Id<"videoClipVersions">;
  onSelectImage: (id: Id<"imageVersions">) => void;
  onSelectVideo: (id: Id<"videoClipVersions">) => void;
  isSelecting: boolean;
  onGenerateVideo: (imageVersionId: Id<"imageVersions">) => void;
  isGeneratingThisVideo: boolean;
  isDraggable: boolean; // [ADD]
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { t } = useTranslation();

  return (
    <div className="p-2 rounded-lg border bg-card/50 space-y-2">
      <ImageVersionCard
        version={version}
        isSelected={isImageSelected}
        onSelect={() => onSelectImage(version._id)}
        isSelecting={isSelecting}
        onGenerateVideo={() => onGenerateVideo(version._id)}
        isGeneratingThisVideo={isGeneratingThisVideo}
        isDraggable={isDraggable} // [ADD]
      />
      {version.videoSubVersions.length > 0 && (
        <div className="pl-2 pr-1 space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground h-8"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronDown
              className={cn(
                "mr-2 h-4 w-4 transition-transform",
                !isExpanded && "-rotate-90",
              )}
            />
            {t("videoClipsCount", {
              count: version.videoSubVersions.length,
            })}
          </Button>
          {isExpanded && (
            <div className="pl-4 border-l-2 ml-2 space-y-2">
              {version.videoSubVersions.map((clip) => (
                <VideoClipCard
                  key={clip._id}
                  clip={clip}
                  isSelected={clip._id === selectedVideoClipId}
                  onSelect={() => onSelectVideo(clip._id)}
                  isSelecting={isSelecting}
                  isDraggable={isDraggable} // [ADD]
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DroppableAssetPreview({
  asset,
  onClear,
  altText,
  frameType,
}: {
  asset: HistoryTimelineNode;
  onClear: () => void;
  altText: string;
  frameType: "start" | "end";
}) {
  const imageUrl =
    asset.type === "image"
      ? asset.version.previewImageUrl
      : frameType === "start" && asset.version.lastFramePosterUrl
        ? asset.version.lastFramePosterUrl
        : asset.version.posterUrl;

  return (
    <>
      <img
        src={imageUrl || undefined}
        alt={altText}
        className="h-full w-full object-contain rounded-md"
      />
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={onClear}
      >
        <X className="h-4 w-4" />
      </Button>
    </>
  );
}

// [FIX] Restore correct prop types
function DroppableSlot({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative group aspect-video w-full rounded-lg border-2 border-dashed bg-muted/50 flex flex-col items-center justify-center text-center p-2 transition-all",
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      {children}
    </div>
  );
}

export default function SegmentEditor() {
  const { storyId, segmentId } = Route.useParams();

  const [activeDragData, setActiveDragData] = useState<{
    type: string;
    item:
      | ImageVersionWithSubVersions
      | (Doc<"videoClipVersions"> & {
          videoUrl: string | null;
          posterUrl: string | null;
          lastFramePosterUrl: string | null;
        });
  } | null>(null);

  const {
    // Data
    segment,
    versionHistory,
    selectedImageVersion,
    selectedVideoClipVersion,
    // State
    isLoading,
    isGenerating,
    isSelecting,
    promptText,
    setPromptText,
    tuningPrompt,
    setTuningPrompt,
    // Transition State & Setters
    startFrameSourceId,
    setStartFrameSourceId,
    endFrameSourceId,
    setEndFrameSourceId,
    transitionPrompt,
    setTransitionPrompt,
    // Mutations
    regenerateImageMutation,
    editImageMutation,
    selectImageMutation,
    selectVideoMutation,
    generateImageToVideoMutation,
    generateTextToVideoMutation,
    generateTransitionMutation,
  } = useSegmentEditor(segmentId as Id<"segments">);

  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState("quick-edit"); // [ADD]
  const isTransitionMode = activeTab === "transition"; // [ADD]

  const [textToVideoPrompt, setTextToVideoPrompt] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState<
    Id<"characters"> | "none"
  >("none");

  const versionHistoryMap = useMemo(() => {
    const map = new Map<string, HistoryTimelineNode>();
    for (const node of versionHistory) {
      map.set(node.version._id, node);
    }
    return map;
  }, [versionHistory]);

  const startFrameAsset = startFrameSourceId
    ? versionHistoryMap.get(startFrameSourceId)
    : null;

  const endFrameAsset = endFrameSourceId
    ? versionHistoryMap.get(endFrameSourceId)
    : null;

  const { data: readyCharacters } = useQuery(
    convexQuery(api.characters.getReady, {}),
  );

  const { open: openMediaLibrary, setOnSelect } = useMediaLibraryStore();

  const handleRegenerate = () => {
    if (!promptText.trim()) return toast.error(t("toastPromptEmpty"));
    regenerateImageMutation.mutate({
      segmentId: segment!._id,
      prompt: promptText,
      characterId:
        selectedCharacterId === "none" ? undefined : selectedCharacterId,
    });
  };

  const handleEditImage = () => {
    if (!tuningPrompt.trim()) return toast.error(t("toastEditPromptEmpty"));
    if (!selectedImageVersion) return toast.error(t("toastNoVersionSelected"));
    // [FIX] Pass correct arguments to the mutation
    editImageMutation.mutate({
      segmentId: segment!._id,
      newInstruction: tuningPrompt,
      versionIdToEdit: selectedImageVersion._id,
      originalPrompt: selectedImageVersion.prompt,
    });
  };

  const handleSelectImageVersion = (versionId: Id<"imageVersions">) => {
    if (isSelecting) return;
    selectImageMutation.mutate({ segmentId: segment!._id, versionId });
  };

  const handleSelectVideoClipVersion = (versionId: Id<"videoClipVersions">) => {
    if (isSelecting) return;
    selectVideoMutation.mutate({
      segmentId: segment!._id,
      videoClipVersionId: versionId,
    });
  };

  const handleSelectFromLibrary = (result: SearchResult) => {
    if (result.resultType === "image") {
      selectImageMutation.mutate({
        segmentId: segment!._id,
        versionId: result._id,
      });
    } else if (result.resultType === "video") {
      selectVideoMutation.mutate({
        segmentId: segment!._id,
        videoClipVersionId: result._id,
      });
    }
  };

  const handleOpenLibrary = () => {
    setOnSelect(handleSelectFromLibrary);
    openMediaLibrary();
  };

  const handleGenerateImageToVideo = (imageVersionId: Id<"imageVersions">) => {
    generateImageToVideoMutation.mutate({
      segmentId: segment!._id,
      imageVersionId,
    });
  };

  const handleGenerateTextToVideo = () => {
    if (!textToVideoPrompt.trim())
      return toast.error(t("toastVideoPromptEmpty"));
    generateTextToVideoMutation.mutate({
      segmentId: segment!._id,
      prompt: textToVideoPrompt,
    });
  };

  const handleGenerateTransition = () => {
    if (!startFrameSourceId || !endFrameSourceId) {
      toast.error(t("toastTransitionMissingFrames"));
      return;
    }
    generateTransitionMutation.mutate({
      segmentId: segment!._id,
      startFrameSourceId,
      endFrameSourceId,
      prompt: transitionPrompt,
    });
  };

  const isAnyMutationPending =
    isGenerating ||
    regenerateImageMutation.isPending ||
    editImageMutation.isPending ||
    generateImageToVideoMutation.isPending ||
    generateTextToVideoMutation.isPending ||
    generateTransitionMutation.isPending;

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current) {
      const { type, item } = event.active.data.current;
      setActiveDragData({ type, item });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragData(null);
    const { over, active } = event;

    if (over && active.data.current) {
      // [FIX] The 'id' from dnd-kit is now the correct, raw asset ID
      const sourceId = active.id as
        | Id<"imageVersions">
        | Id<"videoClipVersions">;

      if (over.id === "start-frame-slot") {
        setStartFrameSourceId(sourceId);
        toast.success(t("toastStartFrameSet"));
      } else if (over.id === "end-frame-slot") {
        setEndFrameSourceId(sourceId);
        toast.success(t("toastEndFrameSet"));
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (!segment) {
    return <div>{t("segmentNotFound")}</div>;
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="container mx-auto max-w-5xl p-4 pt-2">
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/stories/$storyId" params={{ storyId }}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("backToStory")}
            </Link>
          </Button>
        </div>

        <div className="space-y-6">
          <h1 className="text-2xl font-bold">
            {t("editSceneTitle", { order: segment.order + 1 })}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-[1fr,320px] gap-8 items-start">
            <div className="space-y-4">
              <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
                {isAnyMutationPending ? (
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <span>{t("generationInProgress")}</span>
                  </div>
                ) : selectedVideoClipVersion?.videoUrl ? (
                  <video
                    src={selectedVideoClipVersion.videoUrl}
                    className="h-full w-full object-contain"
                    autoPlay
                    loop
                    muted
                    playsInline
                    key={selectedVideoClipVersion._id}
                  />
                ) : selectedImageVersion?.previewImageUrl ? (
                  <img
                    src={selectedImageVersion.previewImageUrl}
                    alt={selectedImageVersion.prompt ?? t("imageAltScene")}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    {t("imageNotAvailable")}
                  </div>
                )}
              </div>
              <Tabs
                value={activeTab} // [ADD]
                onValueChange={setActiveTab} // [ADD]
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="quick-edit">
                    <Bot className="mr-2 h-4 w-4" />
                    {t("tabQuickEdit")}
                  </TabsTrigger>
                  <TabsTrigger value="regenerate">
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t("tabRegenerate")}
                  </TabsTrigger>
                  <TabsTrigger value="generate-video">
                    <Video className="mr-2 h-4 w-4" />
                    {t("tabGenerateVideo")}
                  </TabsTrigger>
                  <TabsTrigger value="transition">
                    <Shuffle className="mr-2 h-4 w-4" />
                    {t("tabTransition", "Transition")}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="quick-edit">
                  <div className="space-y-4 rounded-b-lg border border-t-0 bg-background p-4">
                    <div className="space-y-1">
                      <h4 className="font-semibold">{t("quickEditTitle")}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t("quickEditDescription")}
                      </p>
                    </div>
                    <div className="grid w-full gap-2">
                      <Label htmlFor="tuning-prompt-input">
                        {t("editPromptLabel")}
                      </Label>
                      <Textarea
                        id="tuning-prompt-input"
                        placeholder={t("editPromptPlaceholder")}
                        rows={3}
                        value={tuningPrompt}
                        onChange={(e) => setTuningPrompt(e.target.value)}
                        disabled={isAnyMutationPending || !selectedImageVersion}
                      />
                      {!selectedImageVersion && !isAnyMutationPending && (
                        <p className="text-xs text-amber-600 dark:text-amber-500">
                          {t("editPromptError")}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleEditImage}
                      disabled={isAnyMutationPending || !selectedImageVersion}
                      className="w-full"
                    >
                      {editImageMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Bot className="mr-2 h-4 w-4" />
                      )}
                      {editImageMutation.isPending
                        ? t("buttonEditing")
                        : t("buttonApplyEdit")}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="regenerate">
                  <div className="space-y-4 rounded-b-lg border border-t-0 bg-background p-4">
                    <div className="space-y-1">
                      <h4 className="font-semibold">{t("regenerateTitle")}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t("regenerateDescription")}
                      </p>
                    </div>
                    <div className="grid w-full gap-2">
                      <Label htmlFor="prompt-input">{t("promptLabel")}</Label>
                      <div className="space-y-2">
                        <Label>
                          {t("characterLabel", "Character (Optional)")}
                        </Label>
                        <Select
                          value={selectedCharacterId}
                          onValueChange={(value) =>
                            setSelectedCharacterId(value as any)
                          }
                          disabled={isAnyMutationPending}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t(
                                "characterSelectPlaceholder",
                                "Select a character...",
                              )}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              {t("noCharacter", "None (Default)")}
                            </SelectItem>
                            {readyCharacters?.map((char) => (
                              <SelectItem key={char._id} value={char._id}>
                                <div className="flex items-center gap-2">
                                  {char.coverImageUrl ? (
                                    <img
                                      src={char.coverImageUrl}
                                      className="h-6 w-6 rounded-full object-cover"
                                      alt={char.name}
                                    />
                                  ) : (
                                    <Users className="h-6 w-6 p-1 rounded-full bg-muted" />
                                  )}
                                  <span>{char.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea
                        id="prompt-input"
                        placeholder={t("promptPlaceholder")}
                        rows={6}
                        value={promptText}
                        onChange={(e) => setPromptText(e.target.value)}
                        disabled={isAnyMutationPending}
                      />
                    </div>
                    <Button
                      onClick={handleRegenerate}
                      disabled={isAnyMutationPending}
                      className="w-full"
                    >
                      {regenerateImageMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      {regenerateImageMutation.isPending
                        ? t("buttonGenerating")
                        : t("buttonGenerateNewVersion")}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="generate-video">
                  <div className="space-y-4 rounded-b-lg border border-t-0 bg-background p-4">
                    <div className="space-y-1">
                      <h4 className="font-semibold">{t("textToVideoTitle")}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t("textToVideoDescription")}
                      </p>
                    </div>
                    <div className="grid w-full gap-2">
                      <Label htmlFor="video-prompt-input">
                        {t("videoPromptLabel")}
                      </Label>
                      <Textarea
                        id="video-prompt-input"
                        placeholder={t("videoPromptPlaceholder")}
                        rows={3}
                        value={textToVideoPrompt}
                        onChange={(e) => setTextToVideoPrompt(e.target.value)}
                        disabled={isAnyMutationPending}
                      />
                    </div>
                    <Button
                      onClick={handleGenerateTextToVideo}
                      disabled={isAnyMutationPending}
                      className="w-full"
                    >
                      {generateTextToVideoMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Video className="mr-2 h-4 w-4" />
                      )}
                      {generateTextToVideoMutation.isPending
                        ? t("buttonGenerating")
                        : t("buttonGenerateVideoClip")}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="transition">
                  <div className="space-y-4 rounded-b-lg border border-t-0 bg-background p-4">
                    <div className="space-y-1">
                      <h4 className="font-semibold">
                        {t("transitionTitle", "Generate Transition")}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {t(
                          "transitionDescription",
                          "Create a seamless transition video between two scenes. Drag and drop assets from the right panel into the slots below.",
                        )}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <DroppableSlot id="start-frame-slot">
                        {startFrameAsset ? (
                          <DroppableAssetPreview
                            asset={startFrameAsset}
                            onClear={() => setStartFrameSourceId(null)}
                            altText={t("startFrame")}
                            frameType="start"
                          />
                        ) : (
                          <>
                            <p className="font-semibold">
                              {t("startFrame", "Start Frame")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t(
                                "dropStartFrame",
                                "Drag an asset for the start frame",
                              )}
                            </p>
                          </>
                        )}
                      </DroppableSlot>
                      <DroppableSlot id="end-frame-slot">
                        {endFrameAsset ? (
                          <DroppableAssetPreview
                            asset={endFrameAsset}
                            onClear={() => setEndFrameSourceId(null)}
                            altText={t("endFrame")}
                            frameType="end"
                          />
                        ) : (
                          <>
                            <p className="font-semibold">
                              {t("endFrame", "End Frame")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t(
                                "dropEndFrame",
                                "Drag an asset for the end frame",
                              )}
                            </p>
                          </>
                        )}
                      </DroppableSlot>
                    </div>

                    <div className="grid w-full gap-2">
                      <Label htmlFor="transition-prompt-input">
                        {t("transitionPromptLabel", "Transition Effect Prompt")}
                      </Label>
                      <Textarea
                        id="transition-prompt-input"
                        placeholder={t(
                          "transitionPromptPlaceholder",
                          "e.g., a fast blur, dissolve into light, camera pans quickly...",
                        )}
                        rows={2}
                        value={transitionPrompt}
                        onChange={(e) => setTransitionPrompt(e.target.value)}
                        disabled={isAnyMutationPending}
                      />
                    </div>
                    <Button
                      onClick={handleGenerateTransition}
                      disabled={
                        isAnyMutationPending ||
                        !startFrameSourceId ||
                        !endFrameSourceId
                      }
                      className="w-full"
                    >
                      {generateTransitionMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Shuffle className="mr-2 h-4 w-4" />
                      )}
                      {t("buttonGenerateTransition", "Generate Transition")}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="w-full md:w-80 space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">
                  {t("uploadCustomMedia", "Upload Media")}
                </h3>
                <MediaUploader segmentId={segment._id} />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleOpenLibrary}
                >
                  <Library className="mr-2 h-4 w-4" />
                  {t("useFromLibrary")}
                </Button>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">{t("versionHistory")}</h3>
                <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2 border rounded-lg p-2 bg-muted/50">
                  {versionHistory.length === 0 && !isAnyMutationPending && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t("noVersionHistory")}
                    </p>
                  )}
                  {versionHistory.map((node) => {
                    if (node.type === "image") {
                      return (
                        <ImageVersionNode
                          key={node.version._id}
                          version={node.version}
                          isImageSelected={
                            node.version._id === selectedImageVersion?._id
                          }
                          selectedVideoClipId={selectedVideoClipVersion?._id}
                          onSelectImage={handleSelectImageVersion}
                          onSelectVideo={handleSelectVideoClipVersion}
                          isSelecting={isSelecting}
                          onGenerateVideo={handleGenerateImageToVideo}
                          isGeneratingThisVideo={
                            generateImageToVideoMutation.isPending &&
                            generateImageToVideoMutation.variables
                              ?.imageVersionId === node.version._id
                          }
                          isDraggable={isTransitionMode} // [ADD]
                        />
                      );
                    } else {
                      return (
                        <VideoClipCard
                          key={node.version._id}
                          clip={node.version}
                          isSelected={
                            node.version._id === selectedVideoClipVersion?._id
                          }
                          onSelect={() =>
                            handleSelectVideoClipVersion(node.version._id)
                          }
                          isSelecting={isSelecting}
                          isDraggable={isTransitionMode} // [ADD]
                        />
                      );
                    }
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeDragData ? (
          <div className="rounded-lg shadow-2xl overflow-hidden bg-muted flex items-center justify-center w-40 aspect-video">
            {(() => {
              const url =
                activeDragData.type === "image"
                  ? (activeDragData.item as ImageVersionWithSubVersions)
                      .previewImageUrl
                  : (
                      activeDragData.item as Doc<"videoClipVersions"> & {
                        posterUrl: string | null;
                        lastFramePosterUrl: string | null;
                      }
                    ).posterUrl;

              if (url) {
                return (
                  <img
                    src={url}
                    alt={t("imageAltScene")}
                    className="w-full h-full object-contain"
                  />
                );
              }
              return (
                <Clapperboard className="h-10 w-10 text-muted-foreground" />
              );
            })()}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
