import { createFileRoute } from "@tanstack/react-router";
import { List, Pencil, Wand2, BookOpen, Loader2 } from "lucide-react";
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

  const handleCreateStory = async () => {
    const toastId = toast.loading(t("creatingStory"));
    try {
      const storyId = await createStory({});
      toast.loading(t("initializingEditor"), { id: toastId });
      await initializeEditor({ storyId });
      toast.success(t("storyCreatedSuccess"), { id: toastId });
      navigate({
        to: "/stories/$storyId/refine",
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

  const apps = [
    {
      onClick: handleCreateStory,
      icon: <Pencil className="h-8 w-8 stroke-[1.5px] text-primary/60" />,
      title: t("scriptTitle"),
    },
    {
      onClick: handleNavigateToGenerate,
      icon: <Wand2 className="h-8 w-8 stroke-[1.5px] text-primary/60" />,
      title: t("guidedTitle"),
    },
    {
      onClick: handleCreateStory,
      icon: <List className="h-8 w-8 stroke-[1.5px] text-primary/60" />,
      title: t("segmentTitle"),
    },
  ];

  return (
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
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
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
            <div className="relative flex w-full flex-row items-center justify-center gap-6 overflow-hidden rounded-lg border border-border bg-secondary px-6 py-24 dark:bg-card">
              {apps.map((app, idx) => (
                <div
                  key={idx}
                  className="z-10 flex max-w-[320px] flex-1 flex-col items-center gap-4"
                >
                  <button
                    onClick={app.onClick}
                    disabled={isPending}
                    className={cn(
                      `${buttonVariants({ variant: "ghost", size: "sm" })} flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-card hover:border-primary/40`,
                    )}
                  >
                    {app.icon}
                  </button>
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-base font-medium text-primary">
                      {app.title}
                    </p>
                  </div>
                </div>
              ))}
              <div className="base-grid absolute h-full w-full opacity-40" />
              <div className="absolute bottom-0 h-full w-full bg-gradient-to-t from-[hsl(var(--card))] to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
