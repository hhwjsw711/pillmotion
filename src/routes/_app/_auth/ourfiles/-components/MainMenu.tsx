import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { Button } from "@/ui/button";
import { Menu, ExternalLink } from "lucide-react";

// 直接从环境变量获取 Dashboard URL
const dashboardUrl = import.meta.env.VITE_CONVEX_DASHBOARD_URL;

export const MainMenu: React.FC = () => {
  const handleDashboardClick = () => {
    if (dashboardUrl) {
      window.open(dashboardUrl, "_blank");
    } else {
      console.error(
        "VITE_CONVEX_DASHBOARD_URL environment variable is not set.",
      );
    }
  };

  if (!dashboardUrl) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-400 hover:text-gray-600"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDashboardClick}>
          <ExternalLink className="w-4 h-4 mr-2" />
          Open Dashboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
