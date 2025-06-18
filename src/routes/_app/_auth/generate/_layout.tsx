import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Navigation } from "./-ui.navigation";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";

export const Route = createFileRoute('/_app/_auth/generate/_layout')({
  component: GenerateLayout,
});

function GenerateLayout() {
  const { data: user } = useQuery(convexQuery(api.app.getCurrentUser, {}));
  if (!user) {
    return null;
  }
  return (
    <div className="flex h-screen w-full flex-col bg-secondary dark:bg-black">
      <Navigation user={user} />
      <Outlet />
    </div>
  );
}
