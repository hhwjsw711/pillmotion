import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id, Doc } from "~/convex/_generated/dataModel";
import { ArrowLeft, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/utils/misc";
import { ImageUploader } from "../../../../-components/image-uploader";

export const Route = createFileRoute(
  "/_app/_auth/stories/_layout/$storyId/segments/$segmentId/",
)({
  component: SegmentEditor,
});

function VersionCard({
  version,
  isSelected,
  onSelect,
  isSelecting,
}: {
  version: Doc<"imageVersions">;
  isSelected: boolean;
  onSelect: () => void;
  isSelecting: boolean;
}) {
  const thumbnailUrl = useQuery(
    api.files.getUrl,
    version.previewImage ? { storageId: version.previewImage } : "skip",
  );

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2 bg-card",
        isSelected && "ring-2 ring-blue-500 border-blue-500",
      )}
    >
      <div className="aspect-video w-full rounded bg-gray-100 dark:bg-gray-800">
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            className="h-full w-full object-contain rounded"
            alt={version.prompt ?? "User uploaded image"}
          />
        )}
      </div>
      {version.prompt && (
        <p className="text-xs text-muted-foreground italic line-clamp-2">
          "{version.prompt}"
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        来源: {version.source === "ai_generated" ? "AI 生成" : "用户上传"}
      </p>
      <Button
        variant={isSelected ? "default" : "secondary"}
        size="sm"
        className="w-full"
        onClick={onSelect}
        disabled={isSelected || isSelecting}
      >
        {isSelected && <CheckCircle2 className="mr-2 h-4 w-4" />}
        {isSelected ? "当前版本" : "选择此版本"}
      </Button>
    </div>
  );
}

export default function SegmentEditor() {
  const { storyId, segmentId } = Route.useParams();
  const [promptText, setPromptText] = useState("");
  const prevIsGenerating = useRef<boolean | undefined>();

  const segment = useQuery(api.segments.get, {
    id: segmentId as Id<"segments">,
  });
  const versions = useQuery(api.imageVersions.getBySegment, {
    segmentId: segmentId as Id<"segments">,
  });

  const selectedVersion = segment?.selectedVersion;
  const imageUrl = useQuery(
    api.files.getUrl,
    selectedVersion?.image ? { storageId: selectedVersion.image } : "skip",
  );

  const { mutateAsync: regenerateImage, isPending: isRegenerating } =
    useMutation({
      mutationFn: useConvexMutation(api.segments.regenerateImage),
    });

  const { mutate: selectVersion, isPending: isSelecting } = useMutation({
    mutationFn: useConvexMutation(api.imageVersions.selectVersion),
    onSuccess: () => toast.success("已选择新的版本"),
    onError: (err) => {
      toast.error("选择失败，请重试");
      console.error(err);
    },
  });

  useEffect(() => {
    // Prioritize the selected version's prompt
    if (selectedVersion?.prompt) {
      setPromptText(selectedVersion.prompt);
    } else {
      // Fallback to the latest AI-generated prompt if the selected one has no prompt (e.g., user upload)
      const latestAiVersion = versions?.find(
        (v) => v.source === "ai_generated",
      );
      if (latestAiVersion?.prompt) {
        setPromptText(latestAiVersion.prompt);
      } else {
        setPromptText(""); // Clear if no suitable prompt is found
      }
    }
  }, [selectedVersion, versions]);

  useEffect(() => {
    if (
      prevIsGenerating.current === true &&
      segment?.isGenerating === false &&
      !segment?.error
    ) {
      toast.success("图片处理完成！");
    }
    prevIsGenerating.current = segment?.isGenerating;
  }, [segment?.isGenerating, segment?.error]);

  const handleRegenerate = async () => {
    if (!promptText.trim()) {
      toast.error("Prompt 不能为空");
      return;
    }
    await regenerateImage({
      segmentId: segmentId as Id<"segments">,
      prompt: promptText,
    });
    toast.success("新的图片生成任务已开始！");
  };

  const isProcessing = segment?.isGenerating || isRegenerating;

  return (
    <div className="container mx-auto max-w-5xl p-4">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/stories/$storyId" params={{ storyId }}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回故事
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        <h1 className="text-2xl font-bold">
          编辑场景 {segment ? segment.order + 1 : ""}
        </h1>

        {segment === undefined && <div>加载中...</div>}

        {segment && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr,320px] gap-8 items-start">
            <div className="space-y-4">
              <div className="aspect-video w-full overflow-hidden rounded-lg border bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                {imageUrl && !segment.isGenerating ? (
                  <img
                    src={imageUrl}
                    alt="场景图片"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                        <span>生成中...</span>
                      </>
                    ) : (
                      "没有可用的图片"
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-4 rounded-lg border bg-background p-4">
                <h3 className="font-semibold">创建新版本</h3>
                <p className="text-sm text-muted-foreground">
                  在这里通过修改 Prompt 来生成新的图片版本。
                </p>
                <div className="grid w-full gap-2">
                  <Label htmlFor="prompt-input">AI 绘图指令 (Prompt)</Label>
                  <Textarea
                    id="prompt-input"
                    placeholder="请输入详细的英文 Prompt..."
                    rows={6}
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
                <Button
                  onClick={handleRegenerate}
                  disabled={isProcessing}
                  className="w-full"
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {isProcessing ? "处理中..." : "生成新版本"}
                </Button>
              </div>
            </div>

            <div className="w-full md:w-80 space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">上传自定义图片</h3>
                <ImageUploader segmentId={segment._id} />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">版本历史</h3>
                <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2 border rounded-lg p-2 bg-muted/50">
                  {versions === undefined && <div>加载版本历史...</div>}
                  {versions && versions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      暂无历史版本
                    </p>
                  )}
                  {versions?.map((version) => (
                    <VersionCard
                      key={version._id}
                      version={version}
                      isSelected={version._id === selectedVersion?._id}
                      onSelect={() =>
                        selectVersion({
                          segmentId: segment._id,
                          versionId: version._id,
                        })
                      }
                      isSelecting={isSelecting}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
