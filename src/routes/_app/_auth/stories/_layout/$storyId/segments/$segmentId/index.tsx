import { createFileRoute, Link } from "@tanstack/react-router";
import { Id, Doc } from "~/convex/_generated/dataModel";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  Bot,
  Film,
  AlertTriangle,
  ChevronDown,
  Video,
} from "lucide-react";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { cn } from "@/utils/misc";
import { ImageUploader } from "../../-components/image-uploader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { ImageVersionSource } from "~/convex/schema";
import { useTranslation } from "react-i18next";
import {
  useSegmentEditor,
  ImageVersionWithSubVersions,
  DisplayMode,
} from "@/hooks/useSegmentEditor";
import { Spinner } from "@/ui/spinner";
import { useState } from "react";

export const Route = createFileRoute(
  "/_app/_auth/stories/_layout/$storyId/segments/$segmentId/",
)({
  component: SegmentEditor,
});

function ImageVersionCard({
  version,
  isSelected,
  onSelect,
  isSelecting,
  onGenerateVideo,
  isGeneratingVideo,
}: {
  version: ImageVersionWithSubVersions;
  isSelected: boolean;
  onSelect: () => void;
  isSelecting: boolean;
  onGenerateVideo: () => void;
  isGeneratingVideo: boolean;
}) {
  const { t } = useTranslation();

  const sourceDisplayName: Record<ImageVersionSource, string> = {
    ai_generated: t("sourceAIGenerated"),
    ai_edited: t("sourceAIEdited"),
    user_uploaded: t("sourceUserUploaded"),
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2 bg-card",
        isSelected && "ring-2 ring-primary",
      )}
    >
      <div className="aspect-video w-full rounded bg-muted">
        {version.previewImageUrl && (
          <img
            src={version.previewImageUrl}
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
        {t("versionSource", { source: sourceDisplayName[version.source] })}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={isSelected ? "default" : "secondary"}
          size="sm"
          className="w-full"
          onClick={onSelect}
          disabled={isSelected || isSelecting}
        >
          {isSelecting && isSelected ? (
            <Spinner />
          ) : isSelected ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {t("versionCardCurrent")}
            </>
          ) : (
            t("versionCardSelect")
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onGenerateVideo}
          disabled={isGeneratingVideo}
        >
          {isGeneratingVideo ? <Spinner /> : <Video className="mr-2 h-4 w-4" />}
          {t("buttonGenerateVideoClip")}
        </Button>
      </div>
    </div>
  );
}

function VideoClipCard({
  clip,
  isSelected,
  onSelect,
  isSelecting,
}: {
  clip: Doc<"videoClipVersions">;
  isSelected: boolean;
  onSelect: () => void;
  isSelecting: boolean;
}) {
  const { t } = useTranslation();
  const isError = clip.generationStatus === "error";

  return (
    <div
      className={cn(
        "p-2 rounded-lg border bg-background/50 flex items-center justify-between",
        isSelected && "ring-1 ring-primary/80",
        isError && "border-destructive/50 bg-destructive/10",
      )}
    >
      <div className="flex items-center gap-3">
        {isError ? (
          <AlertTriangle className="h-5 w-5 text-destructive" />
        ) : (
          <Film className="h-5 w-5 text-muted-foreground" />
        )}
        <div className="text-xs">
          <p className="font-semibold">
            {isError ? t("videoClipGenFailed") : t("videoClipTitle")}
          </p>
          {isError && clip.statusMessage && (
            <p className="text-destructive/80 line-clamp-1">
              {clip.statusMessage}
            </p>
          )}
        </div>
      </div>
      {!isError && (
        <Button
          variant={isSelected ? "default" : "secondary"}
          size="xs"
          onClick={onSelect}
          disabled={isSelected || isSelecting}
        >
          {isSelected ? t("versionCardCurrent") : t("versionCardSelect")}
        </Button>
      )}
    </div>
  );
}

function ImageVersionNode({
  version,
  isImageSelected,
  selectedVideoClipId,
  onSelectVersion,
  isSelecting,
  onGenerateVideo,
  isGeneratingVideo,
}: {
  version: ImageVersionWithSubVersions;
  isImageSelected: boolean;
  selectedVideoClipId?: Id<"videoClipVersions">;
  onSelectVersion: (
    type: DisplayMode,
    id: Id<"imageVersions"> | Id<"videoClipVersions">,
  ) => void;
  isSelecting: boolean;
  onGenerateVideo: (imageVersionId: Id<"imageVersions">) => void;
  isGeneratingVideo: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { t } = useTranslation();

  return (
    <div className="p-2 rounded-lg border bg-card/50 space-y-2">
      <ImageVersionCard
        version={version}
        isSelected={isImageSelected}
        onSelect={() => onSelectVersion("image", version._id)}
        isSelecting={isSelecting}
        onGenerateVideo={() => onGenerateVideo(version._id)}
        isGeneratingVideo={isGeneratingVideo}
      />
      {version.videoSubVersions.length > 0 && (
        <div className="pl-2 pr-1 space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground h-8"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronDown
              className={cn(
                "mr-2 h-4 w-4 transition-transform",
                !isExpanded && "-rotate-90",
              )}
            />
            {t("videoClipsCount", {
              count: version.videoSubVersions.length,
            })}
          </Button>
          {isExpanded && (
            <div className="pl-4 border-l-2 ml-2 space-y-2">
              {version.videoSubVersions.map((clip) => (
                <VideoClipCard
                  key={clip._id}
                  clip={clip}
                  isSelected={clip._id === selectedVideoClipId}
                  onSelect={() => onSelectVersion("video", clip._id)}
                  isSelecting={isSelecting}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SegmentEditor() {
  const { storyId, segmentId } = Route.useParams();
  const { t } = useTranslation();
  const {
    segment,
    imageVersions,
    imageUrl,
    videoClipUrl,
    displayMode,
    promptText,
    setPromptText,
    tuningPrompt,
    setTuningPrompt,
    handleRegenerate,
    handleEditImage,
    handleSelectVersion,
    isProcessing,
    isSelecting,
    isEditing,
    isRegenerating,
    isLoading,
    generateVideoForImage,
    isGeneratingVideo,
    generatingVideoVariables,
  } = useSegmentEditor(segmentId as Id<"segments">);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (!segment) {
    // Note: The hook could also handle redirection in the future
    return <div>{t("segmentNotFound")}</div>;
  }

  const selectedImageVersion = imageVersions?.find(
    (v) => v._id === segment.selectedVersionId,
  );

  return (
    <div className="container mx-auto max-w-5xl p-4 pt-2">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/stories/$storyId" params={{ storyId }}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToStory")}
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        <h1 className="text-2xl font-bold">
          {t("editSceneTitle", { order: segment.order + 1 })}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-[1fr,320px] gap-8 items-start">
          <div className="space-y-4">
            <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
              {displayMode === "video" && videoClipUrl ? (
                <video
                  src={videoClipUrl}
                  className="h-full w-full object-contain"
                  autoPlay
                  loop
                  muted
                  playsInline
                  key={videoClipUrl}
                />
              ) : imageUrl && !segment.isGenerating ? (
                <img
                  src={imageUrl}
                  alt={t("imageAltScene")}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                      <span>{t("imageGenerating")}</span>
                    </>
                  ) : (
                    t("imageNotAvailable")
                  )}
                </div>
              )}
            </div>
            <Tabs defaultValue="quick-edit" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="quick-edit">
                  <Bot className="mr-2 h-4 w-4" />
                  {t("tabQuickEdit")}
                </TabsTrigger>
                <TabsTrigger value="regenerate">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t("tabRegenerate")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="quick-edit">
                <div className="space-y-4 rounded-b-lg border border-t-0 bg-background p-4">
                  <div className="space-y-1">
                    <h4 className="font-semibold">{t("quickEditTitle")}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t("quickEditDescription")}
                    </p>
                  </div>
                  <div className="grid w-full gap-2">
                    <Label htmlFor="tuning-prompt-input">
                      {t("editPromptLabel")}
                    </Label>
                    <Textarea
                      id="tuning-prompt-input"
                      placeholder={t("editPromptPlaceholder")}
                      rows={3}
                      value={tuningPrompt}
                      onChange={(e) => setTuningPrompt(e.target.value)}
                      disabled={isProcessing || !selectedImageVersion}
                    />
                    {!selectedImageVersion && !isProcessing && (
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        {t("editPromptError")}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleEditImage}
                    disabled={isProcessing || !selectedImageVersion}
                    className="w-full"
                  >
                    {isEditing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Bot className="mr-2 h-4 w-4" />
                    )}
                    {isEditing ? t("buttonEditing") : t("buttonApplyEdit")}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="regenerate">
                <div className="space-y-4 rounded-b-lg border border-t-0 bg-background p-4">
                  <div className="space-y-1">
                    <h4 className="font-semibold">{t("regenerateTitle")}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t("regenerateDescription")}
                    </p>
                  </div>
                  <div className="grid w-full gap-2">
                    <Label htmlFor="prompt-input">{t("promptLabel")}</Label>
                    <Textarea
                      id="prompt-input"
                      placeholder={t("promptPlaceholder")}
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
                    {isRegenerating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {isRegenerating
                      ? t("buttonGenerating")
                      : t("buttonGenerateNewVersion")}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="w-full md:w-80 space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">{t("uploadCustomImage")}</h3>
              <ImageUploader segmentId={segment._id} />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">{t("versionHistory")}</h3>
              <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2 border rounded-lg p-2 bg-muted/50">
                {imageVersions && imageVersions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("noVersionHistory")}
                  </p>
                )}
                {imageVersions?.map((version) => (
                  <ImageVersionNode
                    key={version._id}
                    version={version}
                    isImageSelected={version._id === segment.selectedVersionId}
                    selectedVideoClipId={segment.selectedVideoClipVersionId}
                    onSelectVersion={handleSelectVersion}
                    isSelecting={isSelecting}
                    onGenerateVideo={(imageVersionId) =>
                      generateVideoForImage({
                        type: "image-to-video",
                        imageVersionId,
                      })
                    }
                    isGeneratingVideo={
                      isGeneratingVideo &&
                      generatingVideoVariables?.imageVersionId === version._id
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
