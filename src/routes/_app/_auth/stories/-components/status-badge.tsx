import { Doc } from "~/convex/_generated/dataModel";
import { cn } from "@/utils/misc";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface StatusBadgeProps {
  status: Doc<"story">["generationStatus"];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation();

  if (!status || status === "idle") {
    return null;
  }

  const statusConfig = {
    processing: {
      icon: <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />,
      text: t("statusProcessing"),
      className:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
    },
    completed: {
      icon: <CheckCircle2 className="mr-1 h-3.5 w-3.5" />,
      text: t("statusCompleted"),
      className:
        "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    },
    error: {
      icon: <AlertTriangle className="mr-1 h-3.5 w-3.5" />,
      text: t("statusError"),
      className: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    },
  };

  const config = statusConfig[status];

  if (!config) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        config.className,
      )}
    >
      {config.icon}
      {config.text}
    </div>
  );
}
