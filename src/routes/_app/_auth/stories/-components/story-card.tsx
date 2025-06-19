import { Doc, Id } from "~/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { StatusBadge } from "./status-badge";
import { StoryThumbnail } from "./story-thumbnail";
import React from "react";
import { MoreHorizontal, Trash2, Smartphone, Monitor } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { api } from "~/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip";

// This map connects the lifecycle status from the database to the correct translation key.
const statusTranslationKeys: Record<Doc<"story">["status"], string> = {
  draft: "lifecycleStatusDraft",
  unpublished: "lifecycleStatusUnpublished",
  published: "lifecycleStatusPublished",
  archived: "lifecycleStatusArchived",
};

// Define a more specific type for the story object we expect from the 'list' query.
type StoryWithThumbnail = NonNullable<
  ReturnType<typeof useQuery<typeof api.story.list>>
>[number];

interface StoryCardProps {
  story: StoryWithThumbnail;
  showDeleteButton?: boolean;
  onDelete?: (storyId: Id<"story">) => void;
}

export const StoryCard = React.memo(
  ({ story, showDeleteButton = false, onDelete }: StoryCardProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleDelete = () => {
      if (onDelete) {
        onDelete(story._id);
      }
    };

    const formatIcon =
      story.format === "vertical" ? (
        <Smartphone className="h-3.5 w-3.5" />
      ) : (
        <Monitor className="h-3.5 w-3.5" />
      );

    const formatTooltipText =
      story.format === "vertical"
        ? t("formatVertical", "Vertical Video")
        : t("formatHorizontal", "Horizontal Video");

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

        {/* Format Icon with Tooltip */}
        {story.format && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute left-2 top-2 z-10 cursor-default rounded-full bg-black/50 p-1.5 text-white"
                  onClick={(e) => {
                    // Prevent the card's navigation onClick from firing
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  {formatIcon}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{formatTooltipText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <StoryThumbnail thumbnailUrl={story.thumbnailUrl} />

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
                    onSelect={handleDelete}
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
