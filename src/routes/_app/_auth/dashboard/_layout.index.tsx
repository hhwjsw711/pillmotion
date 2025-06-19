import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ExternalLink, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/misc.js";
import { buttonVariants } from "@/ui/button-util";
import siteConfig from "~/site.config";
import { useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { StoryCard } from "../stories/-components/story-card";
import { StoryCardSkeleton } from "../stories/-components/story-card-skeleton";

export const Route = createFileRoute("/_app/_auth/dashboard/_layout/")({
  component: Dashboard,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Dashboard`,
    headerTitle: "Dashboard",
    headerDescription: "Manage your Apps and view your usage.",
  }),
});

function PublicStoriesFeed() {
  const { t } = useTranslation();
  const stories = useQuery(api.story.listPublic);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6">
        <h2 className="text-xl font-medium text-primary">
          {t("communityStories")}
        </h2>
        <p className="text-sm font-normal text-primary/60">
          {t("discoverAndGetInspired")}
        </p>
      </div>
      <div className="px-6">
        <div className="w-full border-b border-border" />
      </div>
      <div className="p-6">
        {stories === undefined && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <StoryCardSkeleton key={index} />
            ))}
          </div>
        )}
        {stories && stories.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
            <Compass className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="text-xl font-semibold">{t("noPublicStoriesYet")}</h2>
            <p className="mt-1 text-muted-foreground">
              {t("beTheFirstToPublish")}
            </p>
          </div>
        )}
        {stories && stories.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story) => (
              <StoryCard key={story._id} story={story} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        {/* Main content feed */}
        <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
          <PublicStoriesFeed />
        </div>

        {/* Sidebar */}
        <div className="hidden w-full max-w-xs flex-col gap-6 lg:flex">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-6 dark:bg-black">
            <h2 className="text-lg font-medium text-primary">
              {t("readyToCreate")}
            </h2>
            <p className="text-sm font-normal text-primary/60">
              {t("startYourOwnStoryNow")}
            </p>
            <Link
              to="/stories"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "mt-2 gap-2",
              )}
            >
              <Plus className="h-4 w-4" />
              <span>{t("goToMyStories")}</span>
            </Link>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-6 dark:bg-black">
            <h2 className="text-lg font-medium text-primary">
              {t("aboutTheProject")}
            </h2>
            <p className="text-sm font-normal text-primary/60">
              {t("learnMoreFromDocs")}
            </p>
            <a
              target="_blank"
              rel="noreferrer"
              href="https://github.com/get-convex/convex-saas/tree/main/docs"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-2 gap-2",
              )}
            >
              <span>{t("exploreDocumentation")}</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
