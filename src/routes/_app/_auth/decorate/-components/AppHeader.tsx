import * as React from "react";
import { SignOutButton } from "./SignOutButton";
import { Button } from "./Button";
import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { Route as ImageRoute } from "@/routes/_app/_auth/decorate/image/$imageId";
import { Route as DecorateIndexRoute } from "@/routes/_app/_auth/decorate/index";
import { Route as DashboardRoute } from "@/routes/_app/_auth/dashboard/_layout.index";
import { ArrowLeft } from "lucide-react";

interface Props {}

export const AppHeader: React.FC<Props> = ({}) => {
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const isImageRoute = matchRoute({ to: ImageRoute.fullPath });

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md p-4 flex justify-between items-center border-b border-[var(--color-border)] shadow-sm">
      <div className="flex items-center">
        {isImageRoute ? (
          <Button
            variant="secondary"
            onClick={() => navigate({ to: DecorateIndexRoute.to })}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        ) : (
          <Link to={DashboardRoute.to}>
            <img
              src="/images/pill-logo.jpg"
              alt="Logo"
              className="h-10 w-auto max-w-[180px]"
            />
          </Link>
        )}
      </div>
      <SignOutButton />
    </header>
  );
};
