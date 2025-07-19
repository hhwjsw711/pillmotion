import * as React from "react";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "./Button";
import { Route as ImageRoute } from "@/routes/_app/_auth/image-editing/images/$imageId";
import { Route as ImageEditingRoute } from "@/routes/_app/_auth/image-editing/index";

export const AppHeader: React.FC = () => {
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const isImageRoute = matchRoute({ to: ImageRoute.fullPath });

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md p-4 flex justify-between items-center border-b border-border shadow-sm">
      <div className="flex items-center">
        {isImageRoute ? (
          <Button
            variant="secondary"
            className="rounded-full shadow text-gray-700 hover:bg-gray-100 flex items-center"
            onClick={() => navigate({ to: ImageEditingRoute.fullPath })}
            aria-label="Back"
          >
            <span className="text-xl mr-1">←</span> Back
          </Button>
        ) : (
          <img
            src="/logo.png"
            alt="Logo"
            className="h-10 w-auto max-w-[180px]"
          />
        )}
      </div>
    </header>
  );
};
