import { useEffect, useState, useRef } from "react";
import { useConvexMutation, convexQuery } from "@convex-dev/react-query";
import {
  useMutation as useTanstackMutation,
  useQuery,
} from "@tanstack/react-query";
import { api } from "~/convex/_generated/api";
import { Doc, Id } from "~/convex/_generated/dataModel";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { Button } from "@/ui/button";
import { toast } from "sonner";
import {
  User,
  Volume2,
  Loader2,
  Save,
  RefreshCcw,
  Play,
  Pause,
  X,
  MoreVertical, // 1. 导入新图标
  Trash2,
} from "lucide-react";
import {
  DropdownMenu, // 2. 导入Dropdown组件
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { AVAILABLE_AITTS_VOICES } from "~/convex/schema";

type StructuredTextLine = NonNullable<
  Doc<"segments">["structuredText"]
>[number];

interface DialogueEditorProps {
  segment: Doc<"segments">;
}

// A new component for handling audio controls for a single line
function LineAudioControls({
  segmentId,
  line,
}: {
  segmentId: Id<"segments">;
  line: StructuredTextLine;
}) {
  const scheduleGeneration = useConvexMutation(
    api.segments.scheduleGenerateSingleLineVoiceover,
  );
  const deleteVoiceoverMutation = useConvexMutation(
    api.segments.deleteSingleLineVoiceover,
  );

  const { mutate: generate, isPending: isScheduling } = useTanstackMutation({
    mutationFn: () => scheduleGeneration({ segmentId, lineId: line.lineId }),
    onSuccess: () => toast.info(`语音生成已开始。`),
    onError: (err) =>
      toast.error("生成失败。", {
        description: err.message,
      }),
  });

  const { mutate: deleteAudio, isPending: isDeleting } = useTanstackMutation({
    mutationFn: () =>
      deleteVoiceoverMutation({ segmentId, lineId: line.lineId }),
    onSuccess: () => toast.success("音频已删除。"),
    onError: (err) => toast.error("删除失败。", { description: err.message }),
  });

  const { data: audioUrl } = useQuery(
    convexQuery(
      api.files.getFileUrl,
      line.voiceoverStorageId ? { storageId: line.voiceoverStorageId } : "skip",
    ),
  );

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioRef]);

  const isBusy = isScheduling || isDeleting || line.isGeneratingVoiceover;

  if (isBusy) {
    return (
      <div className="flex h-10 w-10 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      </div>
    );
  }

  if (line.voiceoverError) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => generate()}
              size="icon"
              variant="ghost"
              className="h-10 w-10 text-destructive"
            >
              <RefreshCcw className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Generation failed: {line.voiceoverError}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (audioUrl && line.voiceoverStorageId) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-slate-100 dark:bg-slate-800">
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
        <Button onClick={togglePlayPause} size="icon" variant="ghost">
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-6 text-muted-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => generate()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              <span>重新生成</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => deleteAudio()}
              className="text-red-600 dark:text-red-500"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>删除音频</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => generate()}
              size="icon"
              variant="ghost"
              className="text-muted-foreground"
            >
              <Play className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Generate voiceover</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function DialogueEditor({ segment }: DialogueEditorProps) {
  const [lines, setLines] = useState<StructuredTextLine[]>(
    segment.structuredText ?? [],
  );
  const [isDirty, setIsDirty] = useState(false);

  const updateMutation = useConvexMutation(api.segments.updateStructuredText);

  const { mutate: saveChanges, isPending: isSaving } = useTanstackMutation({
    mutationFn: async (newLines: StructuredTextLine[]) => {
      await updateMutation({
        segmentId: segment._id,
        structuredText: newLines,
      });
    },
    onSuccess: () => {
      toast.success("剧本已保存。");
      setIsDirty(false);
    },
    onError: (error) => {
      toast.error("保存失败。", {
        description: error instanceof Error ? error.message : "未知错误",
      });
    },
  });

  useEffect(() => {
    if (!isDirty) {
      setLines(segment.structuredText ?? []);
    }
  }, [segment.structuredText, isDirty]);

  const handleLineChange = (
    lineId: string,
    field: keyof Omit<StructuredTextLine, "lineId">,
    value: string,
  ) => {
    const newLines = lines.map((line) => {
      if (line.lineId === lineId) {
        const oldLine = line;
        const newLine = { ...oldLine, [field]: value };

        if (field === "text" && value !== oldLine.text) {
          newLine.voiceoverStorageId = undefined;
          newLine.voiceoverError = undefined;
          newLine.isGeneratingVoiceover = undefined;
        }
        return newLine;
      }
      return line;
    });
    setLines(newLines);
    if (!isDirty) setIsDirty(true);
  };

  // 5. 添加新行的处理函数
  const handleAddLine = (type: "narration" | "dialogue") => {
    const newLine: StructuredTextLine = {
      lineId: crypto.randomUUID(),
      type,
      text: "",
      characterName: type === "dialogue" ? "" : undefined,
    };
    setLines([...lines, newLine]);
    if (!isDirty) setIsDirty(true);
  };

  // 6. 删除行的处理函数
  const handleRemoveLine = (lineId: string) => {
    setLines(lines.filter((line) => line.lineId !== lineId));
    if (!isDirty) setIsDirty(true);
  };

  return (
    <div className="flex h-full flex-col bg-gray-50 p-3 dark:bg-gray-900/50">
      <div className="flex-grow space-y-3 overflow-y-auto">
        {/* 7. 添加空状态提示 */}
        {lines.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-sm text-muted-foreground">
              <p>这个剧本还是空的。</p>
              <p className="mt-1">点击下方的按钮来添加第一行旁白或对话吧！</p>
            </div>
          </div>
        )}
        {lines.map((line) => (
          <div key={line.lineId} className="flex items-start space-x-2">
            <LineAudioControls segmentId={segment._id} line={line} />

            <div className="flex-1 space-y-1">
              {line.type === "dialogue" ? (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <User className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={line.characterName ?? ""}
                      onChange={(e) =>
                        handleLineChange(
                          line.lineId,
                          "characterName",
                          e.target.value,
                        )
                      }
                      placeholder="角色名称"
                      className="pl-8 text-sm"
                    />
                  </div>
                  <Select
                    value={line.voice ?? "alloy"}
                    onValueChange={(value) =>
                      handleLineChange(line.lineId, "voice", value)
                    }
                  >
                    <SelectTrigger className="w-[120px] text-xs">
                      <SelectValue placeholder="选择声音" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_AITTS_VOICES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v.charAt(0).toUpperCase() + v.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex h-9 items-center space-x-2 px-2">
                  <Volume2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    旁白
                  </span>
                </div>
              )}
              <Textarea
                value={line.text}
                onChange={(e) =>
                  handleLineChange(line.lineId, "text", e.target.value)
                }
                rows={2}
                className="w-full resize-none bg-white dark:bg-gray-800"
                placeholder={
                  line.type === "dialogue"
                    ? "输入对话内容和表演指导..."
                    : "输入旁白内容..."
                }
              />
            </div>
            {/* 8. 添加删除按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 self-center text-muted-foreground hover:text-destructive"
              onClick={() => handleRemoveLine(line.lineId)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      {/* 9. 优化底部操作栏 */}
      <div className="flex flex-none items-center justify-between border-t pt-3 mt-3">
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => handleAddLine("narration")}
            variant="outline"
            size="sm"
          >
            <Volume2 className="mr-2 h-4 w-4" />
            添加旁白
          </Button>
          <Button
            onClick={() => handleAddLine("dialogue")}
            variant="outline"
            size="sm"
          >
            <User className="mr-2 h-4 w-4" />
            添加对话
          </Button>
        </div>
        <div className="flex items-center space-x-4">
          {isDirty && !isSaving && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              有未保存的更改
            </p>
          )}
          <Button
            onClick={() => saveChanges(lines)}
            disabled={!isDirty || isSaving}
            size="sm"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            保存剧本
          </Button>
        </div>
      </div>
    </div>
  );
}
