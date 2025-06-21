import { useConvexAuth } from "@convex-dev/react-query";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { MediaLibraryModal } from "./_auth/-components/media-library";

export const Route = createFileRoute("/_app/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to login page if user is not authenticated.
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading && !isAuthenticated) {
    return null;
  }

  return (
    <>
      <Outlet />
      <MediaLibraryModal />
    </>
  );
}
