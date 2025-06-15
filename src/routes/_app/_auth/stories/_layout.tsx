import {
  createFileRoute,
  Outlet,
} from "@tanstack/react-router";
import { Navigation } from "./-ui.navigation";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";

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
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}