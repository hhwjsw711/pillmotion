import { createFileRoute } from "@tanstack/react-router";
import { List, Pencil, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/misc.js";
import { buttonVariants } from "@/ui/button-util";
import siteConfig from "~/site.config";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { toast } from "sonner";

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

  const isPending = isCreating || isInitializing;

  // 3. 修改 handleCreateStory 来执行两步创建流程
  const handleCreateStory = async () => {
    const toastId = toast.loading("Creating a new story...");
    try {
      // 第 1 步: 创建故事
      const storyId = await createStory({});

      // 第 2 步: 初始化编辑器
      toast.loading("Initializing editor...", { id: toastId });
      await initializeEditor({ storyId });

      toast.success("Story created successfully!", { id: toastId });

      // 第 3 步: 跳转页面
      navigate({
        to: "/stories/$storyId/refine",
        params: { storyId },
      });
    } catch (error) {
      toast.error("Failed to create story.", { id: toastId });
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
          <div className="relative mx-auto flex w-full  flex-col items-center p-6">
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
