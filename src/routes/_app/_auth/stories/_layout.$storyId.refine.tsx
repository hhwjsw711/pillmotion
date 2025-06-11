import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TextEditor } from "./-components/text-editor";
import { Id } from "~/convex/_generated/dataModel";
import { useQuery, useMutation } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { cn } from "@/utils/misc";
import { EditableTitle } from "./-components/editable-title";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/ui/dialog";
import { Smartphone, Monitor, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StoryFormat } from "~/convex/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip";

export const Route = createFileRoute(
  "/_app/_auth/stories/_layout/$storyId/refine",
)({
  component: RefineStory,
  loader: ({ params: { storyId } }) => {
    return { storyId };
  },
  errorComponent: ({ error }) => <div>Error: {error.message}</div>,
});

export default function RefineStory() {
  const { storyId } = Route.useParams();
  const navigate = useNavigate();
  const [format, setFormat] = useState<StoryFormat>("vertical");
  const [isOpen, setIsOpen] = useState(false);

  const { data: story } = useQuery(
    convexQuery(api.story.getStory, {
      storyId: storyId as Id<"story">,
    }),
  );

  const { mutateAsync: generateSegments, isPending } = useMutation({
    mutationFn: useConvexMutation(api.story.generateSegments),
  });

  const handleGenerateSegments = async () => {
    try {
      await generateSegments({
        storyId: storyId as Id<"story">,
        format,
      });
      toast.success("片段生成任务已开始");
      setIsOpen(false);
      navigate({
        to: "/stories/$storyId",
        params: { storyId },
      });
    } catch (error) {
      toast.error("生成片段失败，请重试");
      console.error("Generate segments failed:", error);
    }
  };

  return (
    <div className="flex h-full justify-center py-4 md:py-8">
      <div className={cn("flex h-full w-full max-w-4xl flex-col")}>
        {story && (
          <EditableTitle
            storyId={storyId as Id<"story">}
            initialTitle={story.title}
          />
        )}
        <div className="mb-2 px-4 text-muted-foreground text-xs md:px-8">
          <span>
            最后更新:{" "}
            {story?.updatedAt && new Date(story.updatedAt).toLocaleString()}
          </span>
        </div>
        <div className="relative w-full flex-1">
          <div
            className={cn(
              "h-full w-full resize-none whitespace-pre-wrap bg-transparent px-4 font-serif text-base outline-none placeholder:text-muted-foreground/50 md:px-8",
            )}
          >
            <TextEditor id={storyId as Id<"story">} />
          </div>
        </div>
      </div>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  className="h-12 w-12 shadow-lg"
                  onClick={() => setIsOpen(true)}
                >
                  <Sparkles className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>生成片段</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader className="space-y-2">
              <DialogTitle>选择视频方向</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                竖屏视频适合抖音、快手等平台。横屏视频更适合B站及传统视频播放器。
              </DialogDescription>
            </DialogHeader>
            <div className="py-6">
              <div className="flex gap-4 justify-center">
                <Button
                  variant={format === "vertical" ? "default" : "outline"}
                  onClick={() => setFormat("vertical")}
                  className="flex-1 flex items-center justify-center gap-2 h-12"
                >
                  <Smartphone className="h-5 w-5" />
                  竖屏
                </Button>
                <Button
                  variant={format === "horizontal" ? "default" : "outline"}
                  onClick={() => setFormat("horizontal")}
                  className="flex-1 flex items-center justify-center gap-2 h-12"
                >
                  <Monitor className="h-5 w-5" />
                  横屏
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground/80 text-center border rounded-md p-3 bg-muted/50">
                注意：一旦设置，方向无法更改，除非重新生成所有图像，请谨慎选择！
              </p>
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="flex-1">
                  取消
                </Button>
              </DialogClose>
              <Button
                type="button"
                className="flex-1"
                onClick={handleGenerateSegments}
                disabled={isPending}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? "处理中..." : "确定"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
