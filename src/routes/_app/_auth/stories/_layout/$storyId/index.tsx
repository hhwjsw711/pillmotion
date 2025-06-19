import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SegmentCard } from "./-components/segment-card";
import { useQuery } from "convex/react";
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
  UploadCloud, // <-- Add UploadCloud icon
  Undo2, // <-- Add Undo2 icon
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { SegmentCardSkeleton } from "./-components/segment-card-skeleton";

export const Route = createFileRoute("/_app/_auth/stories/_layout/$storyId/")({
  component: Story,
});

export default function Story() {
  const { storyId } = Route.useParams();
  const { t } = useTranslation();
  const story = useQuery(api.story.getStory, {
    storyId: storyId as Id<"story">,
  });

  if (story === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (story === null) {
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
  segment: Doc<"segments"> & { selectedVersion: Doc<"imageVersions"> | null };
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

function StorySection({ story }: { story: Doc<"story"> }) {
  const { t } = useTranslation();
  const updateStatusMutation = useConvexMutation(api.story.updateStatus);

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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {story.title}
            </h1>
            {story.generationStatus === "processing" && (
              <span className="flex items-center gap-1 text-sm text-blue-500">
                <Spinner />
                {t("statusGenerating")}
              </span>
            )}
            {story.generationStatus === "error" && (
              <span className="text-sm text-red-500">
                {t("statusGenerationFailed")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isUpdatingStatus}>
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
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <Clapperboard className="mr-2 h-4 w-4" />
                  <span>{t("exportVideo")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <StorySegments story={story} />
    </div>
  );
}

function StorySegments({ story }: { story: Doc<"story"> }) {
  const { _id: storyId } = story;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const segments = useQuery(api.segments.getByStory, { storyId });
  const reorderMutation = useConvexMutation(api.segments.reorderSegments);
  const addSegmentMutation = useConvexMutation(api.segments.addSegment);

  const [activeSegments, setActiveSegments] = useState<typeof segments>([]);

  useEffect(() => {
    if (segments) {
      setActiveSegments(segments);
    }
  }, [segments]);

  const { mutate: reorderSegments } = useMutation({
    mutationFn: async (orderedIds: Id<"segments">[]) => {
      await reorderMutation({ storyId, segmentIds: orderedIds });
    },
    onSuccess: () => {
      toast.success(t("toastOrderSaved"));
    },
    onError: (err) => {
      toast.error(t("toastOrderSaveFailed"), {
        description: err instanceof Error ? err.message : t("unknownError"),
      });
      if (segments) setActiveSegments(segments);
    },
  });

  const { mutate: addSegment, isPending: isAdding } = useMutation({
    mutationFn: async () => {
      // We assume the convex mutation returns the ID of the new segment.
      const newSegmentId = await addSegmentMutation({ storyId });
      if (!newSegmentId) {
        throw new Error("The backend did not return an ID for the new scene.");
      }
      return newSegmentId;
    },
    onSuccess: (newSegmentId) => {
      toast.success(t("toastSegmentAdded"));
      // Navigate to the new segment editor immediately.
      navigate({
        to: "/stories/$storyId/segments/$segmentId",
        params: {
          storyId,
          segmentId: newSegmentId,
        },
      });
    },
    onError: (err) => {
      toast.error(t("toastSegmentAddFailed"), {
        description: err instanceof Error ? err.message : t("unknownError"),
      });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setActiveSegments((items) => {
        if (!items) return [];
        const oldIndex = items.findIndex((item) => item._id === active.id);
        const newIndex = items.findIndex((item) => item._id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        reorderSegments(newOrder.map((item) => item._id));
        return newOrder;
      });
    }
  }

  if (segments === undefined) {
    return (
      <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <SegmentCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (segments.length === 0) {
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
        items={activeSegments?.map((s) => s._id) ?? []}
        strategy={rectSortingStrategy}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("totalSegments", { count: segments.length })}
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
            {activeSegments?.map((segment) => (
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
