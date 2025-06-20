import { useState, useEffect, forwardRef } from "react";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation as useTanstackMutation } from "@tanstack/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { Button } from "@/ui/button";
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

    // 处理取消删除
    const handleCancelDelete = () => {
      setIsDeleteDialogOpen(false);
    };

    // 处理确认删除
    const handleConfirmDelete = () => {
      deleteSegment();
    };

    // 处理ESC键关闭对话框
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isDeleteDialogOpen) {
          handleCancelDelete();
        }
      };

      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }, [isDeleteDialogOpen]);

    return (
      <>
        {/* 自定义的删除确认模态窗口 */}
        {isDeleteDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 背景遮罩 */}
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-all"
              onClick={handleCancelDelete}
            ></div>

            {/* 模态框内容 */}
            <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
              {/* 标题和描述 */}
              <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                <h3 className="text-lg font-semibold leading-none tracking-tight">
                  {t("confirmDeleteSegmentTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("confirmDeleteSegmentDescription")}
                </p>
              </div>

              {/* 按钮组 */}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={handleCancelDelete}
                  className="mt-2 sm:mt-0"
                >
                  {t("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="sm:ml-2"
                >
                  {isDeleting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("delete")}
                </Button>
              </div>
            </div>
          </div>
        )}

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
