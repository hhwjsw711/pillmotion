import { useCopyToClipboard } from "usehooks-ts";
import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Copy, BookUp } from "lucide-react";
import { Button } from "@/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip";
import { memo } from "react";
import { toast } from "sonner";
import { api } from "@cvx/_generated/api";

interface MessageActionsProps {
  text: string | null;
  isLoading: boolean;
}

export function PureMessageActions({ text, isLoading }: MessageActionsProps) {
  const [_, copyToClipboard] = useCopyToClipboard();
  const navigate = useNavigate();

  const { mutateAsync: createStory, isPending: isCreating } = useMutation({
    mutationFn: useConvexMutation(api.story.createStory),
  });

  const { mutateAsync: initializeEditor, isPending: isInitializing } =
    useMutation({
      mutationFn: useConvexMutation(api.story.initializeEditor),
    });

  const isPending = isCreating || isInitializing;

  if (isLoading) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-row gap-2 mt-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground"
              variant="outline"
              size="icon"
              disabled={isPending}
              onClick={async () => {
                const textToCopy = text?.trim();
                if (!textToCopy) {
                  toast.error("There's no text to copy!");
                  return;
                }
                await copyToClipboard(textToCopy);
                toast.success("Copied to clipboard!");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground"
              variant="outline"
              size="icon"
              disabled={isPending}
              onClick={async () => {
                if (!text) {
                  toast.error("There is no content to create a story from.");
                  return;
                }
                const toastId = toast.loading("Creating story...");
                try {
                  // 第 1 步: 创建故事
                  const newStoryId = await createStory({ script: text });

                  // 第 2 步: 初始化编辑器
                  toast.loading("Initializing editor...", { id: toastId });
                  await initializeEditor({ storyId: newStoryId });

                  toast.success("Story created successfully!", { id: toastId });

                  // 第 3 步: 跳转页面
                  navigate({
                    to: "/stories/$storyId/refine",
                    params: { storyId: newStoryId },
                  });
                } catch (error) {
                  toast.error("Failed to create story.", { id: toastId });
                  console.error(error);
                }
              }}
            >
              <BookUp className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create Story</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    return (
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.text === nextProps.text
    );
  },
);
