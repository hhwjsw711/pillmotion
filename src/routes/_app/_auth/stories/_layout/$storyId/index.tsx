import { createFileRoute, Link } from "@tanstack/react-router";
import { SegmentCard } from "./-components/segment-card";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { api } from "~/convex/_generated/api";
import { Doc, Id } from "~/convex/_generated/dataModel";
import { Spinner } from "@/ui/spinner";
import { Button } from "@/ui/button";
import {
  ArrowLeft,
  Settings,
  Clapperboard,
  Plus,
  Loader2,
  FileText,
  Palette,
  UploadCloud,
  Undo2,
  Video,
  Scissors,
  CheckCircle2,
  Music,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import {
  DndContext,
  closestCenter,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { SegmentCardSkeleton } from "./-components/segment-card-skeleton";
import { useStoryDetailPage } from "@/hooks/useStoryDetailPage";
import { Badge } from "@/ui/badge";
import { useState, useEffect } from "react";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";

export const Route = createFileRoute("/_app/_auth/stories/_layout/$storyId/")({
  component: Story,
});

// [FIXED & IMPROVED] Infer the return type of the hook to use for props.
// This is the most robust way to handle complex types from external libraries.
type StoryDetailPageReturn = ReturnType<typeof useStoryDetailPage>;
type SegmentWithImageUrl = NonNullable<
  StoryDetailPageReturn["segments"]
>[number];

export default function Story() {
  const { storyId } = Route.useParams();
  const { t } = useTranslation();
  // [MODIFIED] We only need this one hook now for the whole page.
  const { story, isLoading } = useStoryDetailPage(storyId as Id<"story">);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!story) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">
          {t("storyNotFound")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full justify-center pt-2 pb-4 md:pb-8">
      <div className="flex h-full w-full max-w-6xl flex-col space-y-8 px-4">
        <StorySection story={story} />
      </div>
    </div>
  );
}

function SortableSegmentItem({
  segment,
  storyId,
}: {
  segment: SegmentWithImageUrl;
  storyId: Id<"story">;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition: dndTransition,
    isDragging,
  } = useSortable({ id: segment._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: dndTransition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SegmentCard
        segment={segment}
        storyId={storyId}
        dragHandleProps={{ ...attributes, ...listeners }}
        className={isDragging ? "shadow-2xl ring-2 ring-blue-500" : ""}
      />
    </div>
  );
}

function StorySection({
  story,
}: {
  story: NonNullable<ReturnType<typeof useStoryDetailPage>["story"]>;
}) {
  const { t } = useTranslation();
  const storyId = story._id;
  const updateStatusMutation = useConvexMutation(api.story.updateStatus);
  const updateBgmUrlMutation = useConvexMutation(api.story.updateBgmUrl);

  const [isBgmPopoverOpen, setIsBgmPopoverOpen] = useState(false);
  const [bgmUrl, setBgmUrl] = useState(story.bgmUrl ?? "");

  useEffect(() => {
    // When the popover is closed, we keep the input state synced with the database.
    // When it's open, the user is in control, and we don't want to overwrite their input.
    if (!isBgmPopoverOpen) {
      setBgmUrl(story.bgmUrl ?? "");
    }
  }, [story.bgmUrl, isBgmPopoverOpen]);

  const {
    videoVersion,
    isGeneratingClips,
    canGenerateVideo,
    handleGenerateVideo,
    isStitching,
    stitchingProgress,
    canStitchVideo,
    handleStitchVideo,
    // [NEW] Get segment-related functions from the main hook
    segments,
    isAddingSegment,
    addSegment,
    handleDragEnd,
    pointerSensor,
  } = useStoryDetailPage(storyId);

  const { mutate: updateStatus, isPending: isUpdatingStatus } = useMutation({
    mutationFn: async (status: Doc<"story">["status"]) => {
      await updateStatusMutation({ storyId: story._id, status });
    },
    onSuccess: (_, variables) => {
      toast.success(
        t(
          variables === "published"
            ? "toastStoryPublished"
            : "toastStoryUnpublished",
        ),
      );
    },
    onError: (err) => {
      toast.error(t("toastStatusUpdateFailed"), {
        description: err instanceof Error ? err.message : t("unknownError"),
      });
    },
  });

  const { mutate: saveBgm, isPending: isSavingBgm } = useMutation({
    mutationFn: updateBgmUrlMutation,
    onSuccess: () => {
      toast.success(t("bgmSavedSuccessfully", "Background music saved!"));
      setIsBgmPopoverOpen(false);
    },
    onError: (err) => {
      toast.error(t("savingBgmFailed", "Failed to save BGM"), {
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });

  const handleSaveBgm = () => {
    saveBgm({
      storyId,
      bgmUrl,
    });
  };

  const videoStatus = videoVersion?.generationStatus;
  const isAnythingGenerating =
    story.generationStatus === "processing" || isGeneratingClips || isStitching;

  const SmartPrimaryButton = () => {
    if (canStitchVideo) {
      return (
        <Button
          variant="default"
          onClick={handleStitchVideo}
          disabled={isStitching}
          title={t("stitchVideoTooltip")}
        >
          {isStitching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Scissors className="mr-2 h-4 w-4" />
          )}
          {isStitching
            ? `${t("stitching")}... ${stitchingProgress}%`
            : t("stitchVideo")}
        </Button>
      );
    }
    return (
      <Button
        variant="default"
        onClick={handleGenerateVideo}
        disabled={isAnythingGenerating || !canGenerateVideo}
        title={
          !canGenerateVideo
            ? t("mustHaveSegmentsToGenerateVideo")
            : t("generateVideoTooltip")
        }
      >
        {isGeneratingClips ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Clapperboard className="mr-2 h-4 w-4" />
        )}
        {t("generateClips")}
      </Button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="pl-0">
          <Link to="/stories">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToMyStories")}
          </Link>
        </Button>
        <div className="flex flex-col items-start justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {story.title}
            </h1>
            {story.generationStatus === "processing" && (
              <Badge variant="outline" className="flex items-center gap-1.5">
                <Spinner />
                {t("statusGenerating")}
              </Badge>
            )}
            {story.generationStatus === "error" && (
              <Badge variant="destructive">{t("statusGenerationFailed")}</Badge>
            )}
            {isGeneratingClips && (
              <Badge variant="outline" className="flex items-center gap-1.5">
                <Spinner />
                {`${t(videoStatus ?? "generating")}...`}
              </Badge>
            )}
            {isStitching && (
              <Badge variant="outline" className="flex items-center gap-1.5">
                <Spinner />
                {`${t("stitching")}... ${stitchingProgress}%`}
              </Badge>
            )}
            {canStitchVideo && (
              <Badge variant="secondary" className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t("clipsReadyForStitching")}
              </Badge>
            )}
            {videoVersion?.storageId && (
              <Badge variant="success" className="flex items-center gap-1.5">
                <Video className="h-4 w-4" />
                {t("videoReady")}
              </Badge>
            )}
            {videoVersion?.generationStatus === "error" && (
              <Badge variant="destructive">{t("videoFailed")}</Badge>
            )}
          </div>

          <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:flex-row md:items-center">
            <div className="flex flex-grow items-center gap-2">
              <Button variant="outline" className="flex-1 md:flex-none" asChild>
                <Link
                  to="/stories/$storyId/refine"
                  params={{ storyId: story._id }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{t("editScript")}</span>
                </Link>
              </Button>
              <Button variant="outline" className="flex-1 md:flex-none" asChild>
                <Link
                  to="/stories/$storyId/style"
                  params={{ storyId: story._id }}
                >
                  <Palette className="mr-2 h-4 w-4" />
                  <span>{t("styleSettings")}</span>
                </Link>
              </Button>

              <Popover
                open={isBgmPopoverOpen}
                onOpenChange={setIsBgmPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1 md:flex-none"
                    title={t("addBackgroundMusic")}
                    disabled={isAnythingGenerating}
                  >
                    <Music className="mr-2 h-4 w-4" />
                    <span>{t("addBackgroundMusic")}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-96">
                  <div className="space-y-3 p-2">
                    <div className="space-y-1">
                      <h4 className="font-medium">{t("addBackgroundMusic")}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t("bgmDialogDescription")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="bgm-url" className="sr-only">
                        URL
                      </Label>
                      <Input
                        id="bgm-url"
                        value={bgmUrl}
                        onChange={(e) => setBgmUrl(e.target.value)}
                        placeholder="https://..."
                        className="h-9"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        onClick={handleSaveBgm}
                        disabled={isSavingBgm}
                        size="sm"
                      >
                        {isSavingBgm && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {t("save", "Save")}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2">
              <SmartPrimaryButton />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={isUpdatingStatus || isAnythingGenerating}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {story.status !== "published" ? (
                    <DropdownMenuItem
                      onSelect={() => updateStatus("published")}
                    >
                      <UploadCloud className="mr-2 h-4 w-4" />
                      <span>{t("publishStory")}</span>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => updateStatus("draft")}>
                      <Undo2 className="mr-2 h-4 w-4" />
                      <span>{t("unpublishStory")}</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {videoVersion?.storageId && videoVersion.videoUrl && (
        <div className="w-full max-w-3xl mx-auto bg-black rounded-lg shadow-xl overflow-hidden">
          <video
            src={videoVersion.videoUrl}
            controls
            className="w-full h-full"
            key={videoVersion.storageId}
          >
            {t("videoTagNotSupported")}
          </video>
        </div>
      )}

      <StorySegments
        story={story}
        // [NEW] Pass all segment-related data down from the main hook
        segmentsData={segments ?? []}
        isLoading={false} // Loading is handled at the top level now
        isAdding={isAddingSegment}
        addSegment={addSegment}
        handleDragEnd={handleDragEnd}
        pointerSensor={pointerSensor}
      />
    </div>
  );
}

function StorySegments({
  story,
  // [NEW] Receive all data as props now
  segmentsData,
  isLoading,
  isAdding,
  addSegment,
  handleDragEnd,
  pointerSensor,
}: {
  story: NonNullable<ReturnType<typeof useStoryDetailPage>["story"]>;
  segmentsData: SegmentWithImageUrl[];
  isLoading: boolean;
  isAdding: boolean;
  addSegment: () => void;
  handleDragEnd: (event: DragEndEvent) => void;
  // [FIXED] Use the robust ReturnType inference to get the exact type.
  pointerSensor: StoryDetailPageReturn["pointerSensor"];
}) {
  const { _id: storyId } = story;
  const { t } = useTranslation();

  const sensors = useSensors(pointerSensor);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <SegmentCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (segmentsData.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center space-y-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <p className="text-center text-gray-500 dark:text-gray-400">
          {t("noSegmentsInStory")}
        </p>
        <Button onClick={() => addSegment()} disabled={isAdding}>
          {isAdding ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {t("addFirstSegment")}
        </Button>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={segmentsData.map((s) => s._id)}
        strategy={rectSortingStrategy}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("totalSegments", { count: segmentsData.length })}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addSegment()}
              disabled={isAdding}
            >
              {isAdding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {t("addNewSegment")}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-y-8 md:grid-cols-2 md:gap-x-8 lg:grid-cols-3">
            {segmentsData.map((segment) => (
              <SortableSegmentItem
                key={segment._id}
                segment={segment}
                storyId={storyId}
              />
            ))}
          </div>
        </div>
      </SortableContext>
    </DndContext>
  );
}
