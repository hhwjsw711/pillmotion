import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Doc, Id } from "~/convex/_generated/dataModel";
import { Button } from "@/ui/button";
import {
  Clapperboard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Loader2,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { cn } from "@/utils/misc";
import { toast } from "sonner";
import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/alert-dialog";

export const Route = createFileRoute("/_app/_auth/stories/_layout/")({
  component: StoriesPage,
});

// Helper component for the status badge
function StatusBadge({ status }: { status: Doc<"story">["generationStatus"] }) {
  const statusConfig = {
    processing: {
      icon: <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />,
      text: "生成中",
      className:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
    },
    completed: {
      icon: <CheckCircle2 className="mr-1 h-3.5 w-3.5" />,
      text: "已完成",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    },
    error: {
      icon: <AlertTriangle className="mr-1 h-3.5 w-3.5" />,
      text: "失败",
      className: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    },
    idle: {
      icon: <FileText className="mr-1 h-3.5 w-3.5" />,
      text: "草稿",
      className:
        "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    },
  };

  const config = statusConfig[status ?? "idle"];

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        config.className,
      )}
    >
      {config.icon}
      {config.text}
    </div>
  );
}

// Helper component for the story thumbnail
function StoryThumbnail({ storyId }: { storyId: Id<"story"> }) {
  const segments = useQuery(api.segments.getByStory, { storyId });
  const firstSegment = segments?.[0];
  const thumbnailUrl = useQuery(
    api.files.getFileUrl,
    firstSegment?.selectedVersion?.previewImage
      ? { storageId: firstSegment.selectedVersion.previewImage }
      : "skip",
  );

  return (
    <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-gray-200 dark:bg-gray-800">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt="Story thumbnail"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Clapperboard className="h-12 w-12 text-gray-400 dark:text-gray-600" />
        </div>
      )}
    </div>
  );
}

// The main card component for a single story
function StoryCard({ story }: { story: Doc<"story"> }) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const deleteStoryMutation = useConvexMutation(api.story.deleteStory);

  const { mutate: deleteStory, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      await deleteStoryMutation({ storyId: story._id });
    },
    onSuccess: () => {
      toast.success("故事已成功删除。");
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error("删除故事失败。", {
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    },
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteStory();
  };

  return (
    <div className="group relative">
      <Link
        to="/stories/$storyId"
        params={{ storyId: story._id }}
        className="block transition-all duration-300 hover:shadow-md hover:-translate-y-1"
        onClick={(e) => {
          if (isDeleteDialogOpen) {
            e.preventDefault();
          }
        }}
      >
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <StoryThumbnail storyId={story._id} />
          <div className="p-4">
            <div className="flex items-start justify-between">
              <h3 className="mb-1 font-semibold leading-tight line-clamp-2">
                {story.title}
              </h3>
              <StatusBadge status={story.generationStatus} />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <Clock className="mr-1.5 h-3 w-3" />
              <span>
                最后更新: {new Date(story.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </Link>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 z-10 hidden h-8 w-8 group-hover:flex"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDeleteDialogOpen(true);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <AlertDialogContent
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>您确定要删除这个故事吗?</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。这会永久删除您的故事、所有分镜以及生成的图片。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// The main page component
export function StoriesPage() {
  const stories = useQuery(api.story.list, {});
  const navigate = useNavigate();

  const { mutateAsync: createStory, isPending: isCreating } = useMutation({
    mutationFn: useConvexMutation(api.story.createStory),
  });
  const { mutateAsync: initializeEditor, isPending: isInitializing } =
    useMutation({
      mutationFn: useConvexMutation(api.story.initializeEditor),
    });

  const isPending = isCreating || isInitializing;

  const handleCreateStory = async () => {
    const toastId = toast.loading("正在创建新故事...");
    try {
      const storyId = await createStory({});
      toast.loading("正在初始化编辑器...", { id: toastId });
      await initializeEditor({ storyId });
      toast.success("故事已成功创建!", { id: toastId });
      navigate({
        to: "/stories/$storyId/refine",
        params: { storyId },
      });
    } catch (error) {
      const err = error as Error;
      toast.error("创建故事失败。", {
        id: toastId,
        description: err.message,
      });
      console.error("Failed to create story:", err);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 pt-8 pb-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">我的故事集</h1>
        <Button onClick={handleCreateStory} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlusCircle className="mr-2 h-4 w-4" />
          )}
          创作新故事
        </Button>
      </header>

      {stories === undefined && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {stories && stories.length === 0 && (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
          <Clapperboard className="mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">开启您的创作之旅</h2>
          <p className="mt-1 text-muted-foreground">
            这里还没有任何故事，点击按钮开始您的第一个创作吧！
          </p>
          <Button
            className="mt-4"
            onClick={handleCreateStory}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            开始您的第一个故事创作
          </Button>
        </div>
      )}

      {stories && stories.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stories.map((story) => (
            <StoryCard key={story._id} story={story} />
          ))}
        </div>
      )}
    </div>
  );
}
