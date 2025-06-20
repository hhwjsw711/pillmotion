import { useState, useEffect, forwardRef } from "react";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation as useTanstackMutation } from "@tanstack/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { toast } from "sonner";
import { Loader2, GripVertical, MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";

// The data structure we now expect from the `getByStory` query.
type SegmentWithVersion = NonNullable<
  ReturnType<typeof useQuery<typeof api.segments.getByStory>>
>[number];

interface SegmentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  segment: SegmentWithVersion;
  storyId: Id<"story">;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

export const SegmentCard = forwardRef<HTMLDivElement, SegmentCardProps>(
  ({ segment, storyId, dragHandleProps, ...props }, ref) => {
    const { t } = useTranslation();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const { mutate: deleteSegment, isPending: isDeleting } =
      useTanstackMutation({
        mutationFn: async () => {
          await deleteSegmentMutation({ segmentId: segment._id });
        },
        onSuccess: () => {
          toast.success(t("toastSegmentDeleted"));
          setIsDeleteDialogOpen(false);
        },
        onError: (error) => {
          toast.error(t("toastSegmentDeleteFailed"), {
            description:
              error instanceof Error ? error.message : t("unknownError"),
          });
        },
      });

    const [text, setText] = useState(segment.text);
    const updateTextMutation = useConvexMutation(
      api.segments.updateSegmentText,
    );
    const deleteSegmentMutation = useConvexMutation(api.segments.deleteSegment);

    const { mutate: debouncedUpdateText } = useTanstackMutation({
      mutationFn: async (newText: string) => {
        await updateTextMutation({
          segmentId: segment._id,
          text: newText,
        });
      },
    });

    useEffect(() => {
      setText(segment.text);
    }, [segment.text]);

    useEffect(() => {
      if (text === segment.text) {
        return;
      }
      const handler = setTimeout(() => {
        debouncedUpdateText(text);
      }, 500);
      return () => clearTimeout(handler);
    }, [text, segment.text, debouncedUpdateText]);

    return (
      <>
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("confirmDeleteSegmentTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("confirmDeleteSegmentDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteSegment()}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div
          ref={ref}
          {...props}
          className="group/card w-full max-w-sm touch-none overflow-hidden rounded-lg border bg-card text-card-foreground"
        >
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <div className="flex items-center gap-1">
              <button
                {...dragHandleProps}
                className="cursor-grab rounded-md p-1 opacity-50 transition-opacity hover:bg-accent group-hover/card:opacity-100"
                aria-label={t("dragToReorder")}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </button>
              <span className="text-sm font-medium">
                {t("sceneLabel", { order: segment.order + 1 })}
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-full p-1.5 transition-colors hover:bg-accent"
                  aria-label={t("moreOptions")}
                >
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-500 focus:text-red-500"
                  onSelect={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>{t("delete")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="relative">
            <Link
              to="/stories/$storyId/segments/$segmentId"
              params={{ storyId: segment.storyId, segmentId: segment._id }}
              className="block aspect-video w-full cursor-pointer bg-muted transition-opacity hover:opacity-80"
            >
              {segment.isGenerating ? (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t("imageGeneratingInProgress")}
                </div>
              ) : segment.previewImageUrl ? (
                <img
                  src={segment.previewImageUrl}
                  alt={t("sceneLabel", { order: segment.order + 1 })}
                  className="h-full w-full object-contain"
                />
              ) : segment.error ? (
                <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-destructive">
                  {t("generationFailedWithError", { error: segment.error })}
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  {t("noImageAvailableYet")}
                </div>
              )}
            </Link>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="block w-full resize-none border-0 border-t bg-transparent p-3 text-sm focus:ring-0 focus-visible:ring-1 focus-visible:ring-ring"
            placeholder={t("placeholderSegmentDescription")}
          />
        </div>
      </>
    );
  },
);