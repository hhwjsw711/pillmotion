import { Doc } from "~/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { StatusBadge } from "./status-badge";
import { StoryThumbnail } from "./story-thumbnail";
import React from "react";
import { Trash2 } from "lucide-react";

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
        onClick={() =>
          navigate({ to: `/stories/$storyId`, params: { storyId: story._id } })
        }
        className="group relative cursor-pointer overflow-hidden rounded-lg border border-border hover:border-primary/40"
      >
        <StoryThumbnail storyId={story._id} />
        <div className="p-4">
          <h3 className="text-lg font-medium text-primary line-clamp-1">
            {story.title || t("untitledStory")}
          </h3>
          <div className="mt-2 flex items-center justify-between text-sm text-primary/60">
            <span>{new Date(story.updatedAt).toLocaleDateString()}</span>
            <StatusBadge status={story.generationStatus} />
          </div>
        </div>
        {showDeleteButton && onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(story._id);
            }}
            className="absolute top-2 right-2 z-10 hidden h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 group-hover:flex"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  },
);