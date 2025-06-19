import { Doc } from "~/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { StatusBadge } from "./status-badge";
import { StoryThumbnail } from "./story-thumbnail";
import React from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

// This map connects the lifecycle status from the database to the correct translation key.
const statusTranslationKeys: Record<Doc<"story">["status"], string> = {
  draft: "lifecycleStatusDraft",
  unpublished: "lifecycleStatusUnpublished",
  published: "lifecycleStatusPublished",
  archived: "lifecycleStatusArchived",
};

interface StoryCardProps {
  story: Doc<"story">;
  showDeleteButton?: boolean;
  onDelete?: (storyId: string) => void;
}

export const StoryCard = React.memo(
  ({ story, showDeleteButton = false, onDelete }: StoryCardProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
      <div
        className="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md"
        onClick={() =>
          navigate({ to: "/stories/$storyId", params: { storyId: story._id } })
        }
      >
        {/* The Generation Status Badge: Shows only when a background task is active (e.g., "Processing..."). */}
        <div className="absolute right-2 top-2 z-10">
          <StatusBadge status={story.generationStatus} />
        </div>

        <StoryThumbnail storyId={story._id} />

        {/* The main content area of the card. */}
        <div className="flex flex-1 flex-col justify-between p-4">
          <div>
            <h3 className="line-clamp-2 font-semibold tracking-tight">
              {story.title}
            </h3>
            {/* The Lifecycle Status Label: A permanent, low-key text label showing the story's workflow state. */}
            <p className="mt-1 text-xs text-muted-foreground">
              {t(statusTranslationKeys[story.status])}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {t("lastUpdated")}{" "}
              {new Date(story.updatedAt).toLocaleDateString()}
            </p>
            {/* The Action Menu: Appears on hover and contains all story actions. */}
            {showDeleteButton && onDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => {
                      // Prevent the card's navigation onClick from firing
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="z-10 -mr-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                    aria-label={t("moreOptions")}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  onClick={(e) => {
                    // Prevent the card's navigation onClick from firing
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  align="end"
                >
                  <DropdownMenuItem
                    className="text-red-500 focus:text-red-500 focus:bg-red-50/50 dark:focus:bg-red-900/20"
                    onSelect={() => onDelete(story._id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>{t("delete")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    );
  },
);
