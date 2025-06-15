import { createFileRoute } from "@tanstack/react-router";
import { List, Pencil, Wand2, BookOpen, Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/misc.js";
import { buttonVariants } from "@/ui/button-util";
import siteConfig from "~/site.config";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { toast } from "sonner";
import { Doc } from "~/convex/_generated/dataModel";
import { StoryCard } from "../stories/-components/story-card";
import React from "react";
import { CreateStoryDialog } from "../stories/-components/create-story-dialog";
import { StoryCardSkeleton } from "../stories/-components/story-card-skeleton";

export const Route = createFileRoute("/_app/_auth/dashboard/_layout/")({
  component: Dashboard,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Dashboard`,
    headerTitle: "Dashboard",
    headerDescription: "Manage your Apps and view your usage.",
  }),
});

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  const { mutateAsync: createStory, isPending: isCreating } = useMutation({
    mutationFn: useConvexMutation(api.story.createStory),
  });
  const { mutateAsync: initializeEditor, isPending: isInitializing } =
    useMutation({
      mutationFn: useConvexMutation(api.story.initializeEditor),
    });

  // 获取用户的故事列表
  const stories = useConvexQuery(api.story.list, {});

  const isPending = isCreating || isInitializing;

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
      setIsCreateDialogOpen(false); // Close dialog on success
      navigate({
        to: "/stories/$storyId/refine",
        params: { storyId },
      });
    } catch (error) {
      toast.error(t("storyCreatedError"), { id: toastId });
      console.error("Failed to create story:", error);
    }
  };

  const handleCreateSegmentedStory = async () => {
    const toastId = toast.loading(t("creatingStory"));
    try {
      const storyId = await createStory({ title: t("untitledStory") });
      // We skip initializeEditor because the user will create segments manually.
      toast.success(t("storyCreatedSuccess"), { id: toastId });
      navigate({
        to: "/stories/$storyId",
        params: { storyId },
      });
    } catch (error) {
      toast.error(t("storyCreatedError"), { id: toastId });
      console.error("Failed to create story:", error);
    }
  };

  const handleNavigateToGenerate = () => {
    navigate({ to: "/generate" });
  };

  const handleNavigateToDirector = () => {
    // We will create this page in the next step
    navigate({ to: "/generate/director" });
  };

  const apps = [
    {
      onClick: () => setIsCreateDialogOpen(true),
      icon: <Pencil className="h-8 w-8 text-primary" />,
      title: t("manualCreationTitle"),
      description: t("manualCreationDescription"),
    },
    {
      onClick: handleNavigateToGenerate,
      icon: <Wand2 className="h-8 w-8 text-primary" />,
      title: t("aiCreationTitle"),
      description: t("aiCreationDescription"),
    },
    {
      onClick: handleCreateSegmentedStory,
      icon: <List className="h-8 w-8 text-primary" />,
      title: t("segmentedCreationTitle"),
      description: t("segmentedCreationDescription"),
    },
    {
      onClick: handleNavigateToDirector,
      icon: <Bot className="h-8 w-8 text-primary" />,
      title: t("aiDirectorTitle"),
      description: t("aiDirectorDescription"),
    },
  ];

  return (
    <>
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            {/* 我的故事集部分 - 移到最上方 */}
            <div className="flex w-full flex-col rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                  <h2 className="text-xl font-medium text-primary">
                    {t("myStories")}
                  </h2>
                  <p className="text-sm font-normal text-primary/60">
                    {t("viewAndManageStories")}
                  </p>
                </div>
                <button
                  onClick={() => navigate({ to: "/stories" })}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "flex items-center gap-2",
                  )}
                >
                  <BookOpen className="h-4 w-4" />
                  {t("viewAllStories")}
                </button>
              </div>
            </div>
            <div className="flex w-full px-6">
              <div className="w-full border-b border-border" />
            </div>

            {/* 故事列表 */}
            <div className="p-6">
              {stories === undefined ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <StoryCardSkeleton key={index} />
                  ))}
                </div>
              ) : stories.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-primary/60">
                  {t("noStories")}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {stories.slice(0, 6).map((story: Doc<"story">) => (
                    <StoryCard key={story._id} story={story} />
                  ))}
                </div>
              )}
            </div>

            {/* 创作模式选择部分 */}
            <div className="flex w-full flex-col rounded-lg p-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-medium text-primary">
                  {t("craftYourVideo")}
                </h2>
                <p className="text-sm font-normal text-primary/60">
                  {t("selectMode")}
                </p>
              </div>
            </div>
            <div className="flex w-full px-6">
              <div className="w-full border-b border-border" />
            </div>
            <div className="relative mx-auto flex w-full flex-col items-center p-6">
              <div className="relative grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {apps.map((app, idx) => (
                  <div
                    key={idx}
                    onClick={app.onClick}
                    className="group relative flex cursor-pointer flex-col items-center justify-start gap-4 rounded-xl border bg-card p-8 text-center transition-all duration-300 ease-in-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-all group-hover:scale-110">
                      {app.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-primary">
                      {app.title}
                    </h3>
                    <p className="text-sm text-primary/60">{app.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <CreateStoryDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateStory={handleCreateStory}
        isPending={isPending}
      />
    </>
  );
}
