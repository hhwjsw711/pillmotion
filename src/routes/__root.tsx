import { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  useRouter,
} from "@tanstack/react-router";
import React, { Suspense } from "react";
import { Helmet } from "react-helmet-async";
import { Toaster } from "@/ui/sonner";

const TanStackRouterDevtools =
  process.env.NODE_ENV === "development"
    ? () => null // Render nothing in production
    : React.lazy(() =>
        // Lazy load in development
        import("@tanstack/router-devtools").then((res) => ({
          default: res.TanStackRouterDevtools,
          // For Embedded Mode
          // default: res.TanStackRouterDevtoolsPanel
        })),
      );

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: () => {
    const router = useRouter();
    const matchWithTitle = [...router.state.matches]
      .reverse()
      .find((d) => d.routeContext?.title);
    const title = matchWithTitle?.routeContext.title || "Pillmotion";

    return (
      <>
        <Outlet />
        <Helmet>
          <title>{title}</title>
        </Helmet>
        <Suspense>
          <TanStackRouterDevtools />
        </Suspense>
        <Toaster />
      </>
    );
  },
});
