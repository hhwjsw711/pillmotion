import { createFileRoute, Link } from "@tanstack/react-router";
import { SegmentCard } from "../../-components/segment-card";
import { useQuery } from "convex/react";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { api } from "~/convex/_generated/api";
import { Doc, Id } from "~/convex/_generated/dataModel";
import { Spinner } from "@/ui/spinner";
import { Button } from "@/ui/button";
import {
  ArrowLeft,
  Edit,
  Settings,
  Clapperboard,
  Plus,
  Loader2,
} from "lucide-react";
import React, { useEffect, useState } from "react";
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

export const Route = createFileRoute("/_app/_auth/stories/_layout/$storyId/")({
  component: Story,
});

export default function Story() {
  const { storyId } = Route.useParams();
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
        <div className="text-gray-500 dark:text-gray-400">未找到该故事。</div>
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
}: {
  segment: Doc<"segments"> & { selectedVersion: Doc<"imageVersions"> | null };
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: segment._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <SegmentCard
      ref={setNodeRef}
      style={style}
      segment={segment}
      dragHandleProps={{ ...attributes, ...listeners }}
      className={isDragging ? "shadow-2xl ring-2 ring-blue-500" : ""}
    />
  );
}

function StorySection({ story }: { story: Doc<"story"> }) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="pl-0">
          <Link to="/stories">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回我的故事集
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
                生成中...
              </span>
            )}
            {story.generationStatus === "error" && (
              <span className="text-sm text-red-500">生成失败</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link
                to="/stories/$storyId/refine"
                params={{ storyId: story._id }}
              >
                <Edit className="mr-2 h-4 w-4" />
                编辑剧本
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                to="/stories/$storyId/style"
                params={{ storyId: story._id }}
              >
                <Settings className="h-4 w-4" />
                <span className="ml-2">风格设置</span>
              </Link>
            </Button>
            <Button variant="secondary" disabled>
              <Clapperboard className="mr-2 h-4 w-4" />
              导出视频
            </Button>
          </div>
        </div>
      </div>
      <StorySegments story={story} />
    </div>
  );
}

function StorySegments({ story }: { story: Doc<"story"> }) {
  const { _id: storyId } = story;
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
      toast.success("场景顺序已保存。");
    },
    onError: (err) => {
      toast.error("保存顺序失败", {
        description: err instanceof Error ? err.message : "未知错误",
      });
      if (segments) setActiveSegments(segments);
    },
  });

  const { mutate: addSegment, isPending: isAdding } = useMutation({
    mutationFn: async () => {
      await addSegmentMutation({ storyId });
    },
    onSuccess: () => {
      toast.success("新场景已添加到末尾。");
    },
    onError: (err) => {
      toast.error("添加场景失败。", {
        description: err instanceof Error ? err.message : "未知错误",
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
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"
          />
        ))}
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center space-y-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <p className="text-center text-gray-500 dark:text-gray-400">
          这个故事还没有任何场景
        </p>
        <Button onClick={() => addSegment()} disabled={isAdding}>
          {isAdding ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          添加第一个场景
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
              共 {segments.length} 个场景
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
              添加新场景
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {activeSegments?.map((segment) => (
              <SortableSegmentItem key={segment._id} segment={segment} />
            ))}
          </div>
        </div>
      </SortableContext>
    </DndContext>
  );
}
