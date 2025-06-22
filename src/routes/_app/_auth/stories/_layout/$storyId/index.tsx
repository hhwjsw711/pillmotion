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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { DndContext, closestCenter, useSensors } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { SegmentCardSkeleton } from "./-components/segment-card-skeleton";
import { useStorySegments } from "@/hooks/useStorySegments";
import { useStoryDetailPage } from "@/hooks/useStoryDetailPage";
import { Badge } from "@/ui/badge";

export const Route = createFileRoute("/_app/_auth/stories/_layout/$storyId/")({
  component: Story,
});

// [REFACTORED] The type is now correctly inferred from the hook's return value
type SegmentWithImageUrl = ReturnType<
  typeof useStorySegments
>["segmentsData"][number];

export default function Story() {
  const { storyId } = Route.useParams();
  const { t } = useTranslation();
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
  const {
    videoVersion,
    isGeneratingVideo,
    canGenerateVideo,
    handleGenerateVideo,
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

  const videoStatus = videoVersion?.generationStatus;
  const isAnythingGenerating =
    story.generationStatus === "processing" || isGeneratingVideo;

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
            {isGeneratingVideo && (
              <Badge variant="outline" className="flex items-center gap-1.5">
                <Spinner />
                {`${t(videoStatus ?? "generating")}...`}
              </Badge>
            )}
            {videoVersion?.generationStatus === "generated" && (
              <Badge variant="success" className="flex items-center gap-1.5">
                <Video className="h-4 w-4" />
                {t("videoReady")}
              </Badge>
            )}
            {videoVersion?.generationStatus === "error" && (
              <Badge variant="destructive">{t("videoFailed")}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
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
              {isGeneratingVideo ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Clapperboard className="mr-2 h-4 w-4" />
              )}
              {t("generateVideo")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isUpdatingStatus || isAnythingGenerating}
                >
                  {isUpdatingStatus ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="mr-2 h-4 w-4" />
                  )}
                  {t("storySettings")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link
                    to="/stories/$storyId/refine"
                    params={{ storyId: story._id }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <span>{t("editScript")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/stories/$storyId/style"
                    params={{ storyId: story._id }}
                  >
                    <Palette className="mr-2 h-4 w-4" />
                    <span>{t("styleSettings")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {/* Dynamically show Publish or Unpublish button */}
                {story.status !== "published" ? (
                  <DropdownMenuItem onSelect={() => updateStatus("published")}>
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
      <StorySegments story={story} />
    </div>
  );
}

function StorySegments({
  story,
}: {
  story: NonNullable<ReturnType<typeof useStoryDetailPage>["story"]>;
}) {
  const { _id: storyId } = story;
  const { t } = useTranslation();

  // [REFACTORED] 1. Destructure `isLoading` and remove `activeSegments`
  const {
    segmentsData,
    isLoading,
    isAdding,
    addSegment,
    handleDragEnd,
    pointerSensor,
  } = useStorySegments(storyId);

  const sensors = useSensors(pointerSensor);

  // [REFACTORED] 2. Use `isLoading` for a more reliable loading state
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
        // [REFACTORED] 3. Use `segmentsData` for the list items
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
