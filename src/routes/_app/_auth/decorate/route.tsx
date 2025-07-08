import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import { AppHeader } from "./-components/AppHeader";
import { BottomNav } from "./-components/BottomNav";

export const Route = createFileRoute("/_app/_auth/decorate")({
  component: DecorateLayout,
});

function DecorateLayout() {
  const { data: user } = useQuery(convexQuery(api.app.getCurrentUser, {}));
  if (!user) {
    return null;
  }
  return (
    <div className="flex min-h-[100vh] w-full flex-col bg-secondary dark:bg-black">
      <AppHeader />
      <Outlet />
      <BottomNav />
    </div>
  );
}
