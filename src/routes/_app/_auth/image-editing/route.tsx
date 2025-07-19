import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppHeader } from "./-components/AppHeader";
import { BottomNav } from "./-components/BottomNav";
import { Toaster } from "@/ui/sonner";

export const Route = createFileRoute("/_app/_auth/image-editing")({
  component: ImageEditingLayout,
});

export default function ImageEditingLayout() {
  return (
    <div className="h-screen flex flex-col bg-background">
      <main className="flex-1 flex flex-col">
        <AppHeader />
        <Outlet />
        <BottomNav />
      </main>
      <Toaster />
    </div>
  );
}
