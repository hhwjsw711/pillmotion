import { useCopyToClipboard } from "usehooks-ts";
import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Copy, Pencil } from "lucide-react";
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
import { useTranslation } from "react-i18next";

interface MessageActionsProps {
  text: string | null;
  isLoading: boolean;
}

export function PureMessageActions({ text, isLoading }: MessageActionsProps) {
  const { t } = useTranslation();
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
                  toast.error(t("messageActionErrorNoTextToCopy"));
                  return;
                }
                await copyToClipboard(textToCopy);
                toast.success(t("messageActionCopied"));
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("messageActionCopy")}</TooltipContent>
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
                  toast.error(t("messageActionErrorNoContent"));
                  return;
                }
                const toastId = toast.loading(t("creatingStory"));
                try {
                  // 第 1 步: 创建故事
                  const newStoryId = await createStory({
                    title: t("untitledStory"),
                    script: text,
                  });

                  // 第 2 步: 初始化编辑器
                  toast.loading(t("initializingEditor"), { id: toastId });
                  await initializeEditor({ storyId: newStoryId });

                  toast.success(t("storyCreatedSuccess"), { id: toastId });

                  // 第 3 步: 跳转页面
                  navigate({
                    to: "/stories/$storyId/refine",
                    params: { storyId: newStoryId },
                  });
                } catch (error) {
                  toast.error(t("storyCreatedError"), { id: toastId });
                  console.error(error);
                }
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("messageActionCreateStory")}</TooltipContent>
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
