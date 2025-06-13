import { useState, useRef, useEffect, forwardRef } from "react";
import { useQuery } from "convex/react";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation as useTanstackMutation } from "@tanstack/react-query";
import { api } from "~/convex/_generated/api";
import { Doc } from "~/convex/_generated/dataModel";
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
import { toast } from "sonner";
import { Loader2, GripVertical, MoreHorizontal } from "lucide-react";

type SegmentWithVersion = Doc<"segments"> & {
  selectedVersion: Doc<"imageVersions"> | null;
};

interface SegmentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  segment: SegmentWithVersion;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

export const SegmentCard = forwardRef<HTMLDivElement, SegmentCardProps>(
  ({ segment, dragHandleProps, ...props }, ref) => {
    const previewImageUrl = useQuery(
      api.files.getUrl,
      segment.selectedVersion?.previewImage
        ? { storageId: segment.selectedVersion.previewImage }
        : "skip",
    );
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    const { mutate: deleteSegment, isPending: isDeleting } =
      useTanstackMutation({
        mutationFn: async () => {
          await deleteSegmentMutation({ segmentId: segment._id });
        },
        onSuccess: () => {
          toast.success("场景已成功删除。");
          setIsDeleteDialogOpen(false);
        },
        onError: (error) => {
          toast.error("删除失败。", {
            description: error instanceof Error ? error.message : "未知错误",
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

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node)
        ) {
          setIsDropdownOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [dropdownRef]);

    return (
      <>
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确定要删除此场景吗?</AlertDialogTitle>
              <AlertDialogDescription>
                此操作无法撤销。这会永久删除此场景及其所有图片版本。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteSegment()}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div
          ref={ref}
          {...props}
          className="group/card w-full max-w-sm touch-none overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <div className="flex items-center gap-2">
              <button
                {...dragHandleProps}
                className="cursor-grab p-1 opacity-50 transition-opacity group-hover/card:opacity-100"
              >
                <GripVertical className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {`场景 ${segment.order + 1}`}
              </span>
            </div>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="rounded-full p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <MoreHorizontal className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 top-full z-10 mt-2 w-44 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700">
                  <ul className="py-2">
                    <li>
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          setIsDeleteDialogOpen(true);
                        }}
                        className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:text-red-500 dark:hover:bg-gray-600"
                      >
                        删除
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          <Link
            to="/stories/$storyId/segments/$segmentId"
            params={{ storyId: segment.storyId, segmentId: segment._id }}
            className="block aspect-video w-full cursor-pointer bg-gray-100 transition-opacity hover:opacity-80 dark:bg-gray-700"
          >
            {segment.isGenerating ? (
              <div className="flex h-full w-full items-center justify-center text-gray-400">
                图片生成中...
              </div>
            ) : previewImageUrl ? (
              <img
                src={previewImageUrl}
                alt={`场景 ${segment.order + 1}`}
                className="h-full w-full object-contain"
              />
            ) : segment.error ? (
              <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-red-500">
                生成失败: {segment.error}
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-400">
                暂无图片
              </div>
            )}
          </Link>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="block w-full resize-none border-0 bg-gray-50 p-2.5 text-sm text-gray-900 focus:ring-0 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            placeholder="请输入场景描述..."
          />
        </div>
      </>
    );
  },
);
