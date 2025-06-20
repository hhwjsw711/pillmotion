import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Button } from "@/ui/button";
import { Clapperboard, Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { StoryCard } from "./-components/story-card";
import { StoryCardSkeleton } from "./-components/story-card-skeleton";
import { CreateStoryDialog } from "./-components/create-story-dialog";
import React, { useEffect } from "react";
import { Id, Doc } from "~/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/tabs";
import { useStoryActions } from "~/src/hooks/useStoryActions";

type StoryStatusTab = Doc<"story">["status"] | "all";

export const Route = createFileRoute("/_app/_auth/stories/_layout/")({
  component: StoriesPage,
});

export function StoriesPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<StoryStatusTab>("all");

  // 查询故事列表，根据选定的标签过滤
  const stories = useQuery(api.story.list, {
    status: activeTab === "all" ? undefined : activeTab,
  });

  const navigate = useNavigate();

  // 删除相关状态
  const [storyToDelete, setStoryToDelete] = React.useState<Id<"story"> | null>(
    null,
  );
  const [isShowingDeleteModal, setIsShowingDeleteModal] = React.useState(false);

  // 创建故事对话框状态
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  // 使用故事操作钩子
  const { deleteStory, isDeleting, updateStatus, isUpdatingStatus } =
    useStoryActions();

  // 创建故事相关 mutation
  const { mutateAsync: createStory, isPending: isCreating } = useMutation({
    mutationFn: useConvexMutation(api.story.createStory),
  });

  const { mutateAsync: initializeEditor, isPending: isInitializing } =
    useMutation({
      mutationFn: useConvexMutation(api.story.initializeEditor),
    });

  const isPendingCreation = isCreating || isInitializing;

  // 创建故事处理函数
  const handleCreateStory = async ({
    title,
    script,
  }: {
    title?: string;
    script?: string;
  }) => {
    const toastId = toast.loading(t("creatingStory"));
    try {
      const storyId = await createStory({
        title: title || t("untitledStory"),
        script,
      });
      toast.loading(t("initializingEditor"), { id: toastId });
      await initializeEditor({ storyId });
      toast.success(t("storyCreatedSuccess"), { id: toastId });
      setIsCreateDialogOpen(false);
      navigate({
        to: "/stories/$storyId/refine",
        params: { storyId },
      });
    } catch (error) {
      const err = error as Error;
      toast.error(t("storyCreatedError"), {
        id: toastId,
        description: err.message,
      });
      console.error("Failed to create story:", err);
    }
  };

  // 删除请求处理函数
  const handleDeleteRequest = (storyId: Id<"story">) => {
    setStoryToDelete(storyId);
    setIsShowingDeleteModal(true);
  };

  // 取消删除处理函数
  const handleCancelDelete = () => {
    setIsShowingDeleteModal(false);
    // 延迟清除删除ID，确保动画完成后再清除状态
    setTimeout(() => setStoryToDelete(null), 300);
  };

  // 确认删除处理函数
  const handleConfirmDelete = () => {
    if (storyToDelete) {
      deleteStory(storyToDelete);
      setIsShowingDeleteModal(false);
      // 延迟清除删除ID，确保动画完成后再清除状态
      setTimeout(() => setStoryToDelete(null), 300);
    }
  };

  // 添加ESC键监听，用于关闭模态框
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isShowingDeleteModal) {
        handleCancelDelete();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isShowingDeleteModal]);

  // 渲染内容函数
  const renderContent = () => {
    // 显示加载状态
    if (stories === undefined) {
      return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <StoryCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    // 显示空状态
    if (stories.length === 0) {
      if (activeTab === "all") {
        return (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
            <Clapperboard className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="text-xl font-semibold">
              {t("startYourCreationJourney")}
            </h2>
            <p className="mt-1 text-muted-foreground">
              {t("noStoriesYetDescription")}
            </p>
            <Button
              className="mt-4"
              onClick={() => setIsCreateDialogOpen(true)}
              disabled={isPendingCreation}
            >
              {isPendingCreation ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="mr-2 h-4 w-4" />
              )}
              {t("startYourFirstStory")}
            </Button>
          </div>
        );
      } else {
        return (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
            <Clapperboard className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="text-xl font-semibold">
              {t("noStoriesInThisCategory")}
            </h2>
            <p className="mt-1 text-muted-foreground">
              {t("tryDifferentCategoryOrCreate")}
            </p>
          </div>
        );
      }
    }

    // 显示故事列表
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stories.map((story) => (
          <StoryCard
            key={story._id}
            story={story}
            showActionsMenu={true}
            onDelete={handleDeleteRequest}
            onUpdateStatus={updateStatus}
            isUpdatingStatus={isUpdatingStatus}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="container mx-auto max-w-7xl px-4 pt-8 pb-12">
        {/* 页面标题和创建按钮 */}
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t("myStories")}</h1>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={isPendingCreation}
          >
            {isPendingCreation ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            {t("createNewStory")}
          </Button>
        </header>

        {/* 状态标签页 */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as StoryStatusTab)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4 sm:max-w-md">
            <TabsTrigger value="all">{t("statusAll")}</TabsTrigger>
            <TabsTrigger value="draft">{t("statusDraft")}</TabsTrigger>
            <TabsTrigger value="published">{t("statusPublished")}</TabsTrigger>
            <TabsTrigger value="archived">{t("statusArchived")}</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-6">
            {renderContent()}
          </TabsContent>
        </Tabs>
      </div>

      {/* 创建故事对话框 */}
      <CreateStoryDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateStory={handleCreateStory}
        isPending={isPendingCreation}
      />

      {/* 自定义的删除确认模态窗口，不使用 Radix UI 组件 */}
      {isShowingDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 背景遮罩 - 点击可关闭 */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-all"
            onClick={handleCancelDelete}
          ></div>

          {/* 模态框内容 */}
          <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
            {/* 标题和描述 */}
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <h3 className="text-lg font-semibold leading-none tracking-tight">
                {t("confirmDeleteStoryTitle")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("confirmDeleteStoryDescription")}
              </p>
            </div>

            {/* 按钮组 */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={handleCancelDelete}
                className="mt-2 sm:mt-0"
              >
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="sm:ml-2"
              >
                {isDeleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
