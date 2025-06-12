import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  TextEditor,
  useEditorCharacterCount,
} from "../../-components/text-editor";
import { Id } from "~/convex/_generated/dataModel";
import { useQuery, useMutation } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { cn } from "@/utils/misc";
import { EditableTitle } from "../../-components/editable-title";
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
import {
  ArrowLeft,
  CheckCircle2,
  Smartphone,
  Monitor,
  Loader2,
  Sparkles,
} from "lucide-react";
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
    return { storyId: storyId as Id<"story"> };
  },
  errorComponent: ({ error }) => <div>Error: {error.message}</div>,
});

export default function RefineStory() {
  const { storyId } = Route.useLoaderData();
  const navigate = useNavigate();
  const [format, setFormat] = useState<StoryFormat>("vertical");
  const [isOpen, setIsOpen] = useState(false);

  const { data: story } = useQuery(
    convexQuery(api.story.getStory, {
      storyId,
    }),
  );

  const charCount = useEditorCharacterCount(storyId);

  const { mutateAsync: generateSegments, isPending } = useMutation({
    mutationFn: useConvexMutation(api.story.generateSegments),
  });

  const handleGenerateSegments = async () => {
    try {
      await generateSegments({
        storyId,
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
    <div className="h-full flex flex-col">
      {/* Centered container for the main content */}
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col px-4 sm:px-6 lg:px-8 pb-4 md:pb-8">
        {/* Header Section */}
        <header className="flex-shrink-0 pt-2">
          <div className="mb-4">
            <Button variant="ghost" size="sm" asChild className="-ml-3">
              <Link to="/stories/$storyId" params={{ storyId }}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回故事详情
              </Link>
            </Button>
          </div>
          {story && (
            <div className="space-y-2">
              <EditableTitle storyId={storyId} initialTitle={story.title} />
              <div className="text-muted-foreground text-xs">
                <span>
                  最后更新:{" "}
                  {new Date(story.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </header>

        {/* Editor Section */}
        <main className="flex-1 flex flex-col mt-6 min-h-0">
          <div className="flex-1 w-full relative">
            <TextEditor id={storyId} />
          </div>
          <footer className="flex-shrink-0 py-2 border-t text-xs text-muted-foreground flex justify-between items-center">
            <span>字数: {charCount}</span>
            <span className="flex items-center gap-1.5 text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              已自动保存
            </span>
          </footer>
        </main>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  className="h-12 w-auto px-6 shadow-lg rounded-full"
                  onClick={() => setIsOpen(true)}
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  生成片段
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>完成编辑后，生成所有场景</p>
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
