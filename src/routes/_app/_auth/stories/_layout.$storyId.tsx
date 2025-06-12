import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/_auth/stories/_layout/$storyId")({
  component: StoryIdLayout,
});

function StoryIdLayout() {
  return <Outlet />;
}