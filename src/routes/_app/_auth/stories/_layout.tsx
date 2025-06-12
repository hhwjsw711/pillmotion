import {
  createFileRoute,
  Outlet,
  useRouterState,
  Link,
  useParams,
} from "@tanstack/react-router";
import { Navigation } from "./-ui.navigation";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { ChevronRight } from "lucide-react";

function Breadcrumbs() {
  const params = useParams({ strict: false });
  const { storyId, segmentId } = params as {
    storyId?: string;
    segmentId?: string;
  };

  const { pathname } = useRouterState({
    select: (s) => s.location,
  });

  const { data: story } = useQuery(
    convexQuery(
      api.story.getStory,
      storyId ? { storyId: storyId as Id<"story"> } : "skip",
    ),
  );

  const { data: segment } = useQuery(
    convexQuery(
      api.segments.get,
      segmentId ? { id: segmentId as Id<"segments"> } : "skip",
    ),
  );

  const crumbs: { label: string; href?: string }[] = [];

  if (pathname === "/stories" || pathname === "/stories/") {
    return null;
  }

  crumbs.push({ label: "我的故事集", href: "/stories" });

  if (storyId && story) {
    const isLast = !pathname.includes(`${storyId}/`);
    crumbs.push({
      label: story.title,
      href: isLast ? undefined : `/stories/${storyId}`,
    });
  }

  if (segmentId && segment) {
    crumbs.push({ label: `场景 ${segment.order + 1}` });
  } else if (pathname.endsWith("/refine")) {
    crumbs.push({ label: "编辑剧本" });
  } else if (pathname.endsWith("/style")) {
    crumbs.push({ label: "风格设置" });
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 pt-6 pb-2">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center space-x-1 text-sm text-muted-foreground">
          {crumbs.map((crumb, index) => (
            <li key={index} className="flex items-center">
              {index > 0 && <ChevronRight className="h-4 w-4 mx-1.5" />}
              {crumb.href ? (
                <Link
                  to={crumb.href}
                  className="hover:text-foreground hover:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-foreground">
                  {crumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

export const Route = createFileRoute("/_app/_auth/stories/_layout")({
  component: StoriesLayout,
});

function StoriesLayout() {
  const { data: user } = useQuery(convexQuery(api.app.getCurrentUser, {}));
  if (!user) {
    return null;
  }
  return (
    <div className="flex min-h-[100vh] w-full flex-col bg-secondary dark:bg-black">
      <Navigation user={user} />
      <Breadcrumbs />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}