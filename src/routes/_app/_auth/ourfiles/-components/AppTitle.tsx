import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Route as DashboardRoute } from "@/routes/_app/_auth/dashboard/_layout.index";

export const AppTitle: React.FC = () => {
  return (
    <Link
      to={DashboardRoute.to}
      className="fixed top-4 left-4 flex items-center gap-2.5 z-50 select-none"
    >
      <div className="relative group w-12 h-12">
        <img
          src="/images/pill-logo.jpg"
          alt="Convex Logo"
          className="absolute inset-0 w-full h-full transform transition-all duration-300 mt-1.5 group-hover:scale-110 group-hover:-translate-y-1"
        />
      </div>
      <h1 className="text-4xl font-light tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 hover:from-blue-600 hover:to-blue-400 transition-all duration-300 select-none">
        Our<span className="font-semibold">Files</span>
      </h1>
    </Link>
  );
};
