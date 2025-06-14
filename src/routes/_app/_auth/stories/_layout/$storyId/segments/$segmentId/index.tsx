import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id, Doc } from "~/convex/_generated/dataModel";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  Bot,
  FileText,
} from "lucide-react";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/utils/misc";
import { ImageUploader } from "../../../../-components/image-uploader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { ImageVersionSource } from "~/convex/schema";
import { DialogueEditor } from "../../../../-components/dialogue-editor";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const thumbnailUrl = useQuery(
    api.files.getFileUrl,
    version.previewImage ? { storageId: version.previewImage } : "skip",
  );

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
        {t("versionSource", { source: sourceDisplayName[version.source] })}
      </p>
      <Button
        variant={isSelected ? "default" : "secondary"}
        size="sm"
        className="w-full"
        onClick={onSelect}
        disabled={isSelected || isSelecting}
      >
        {isSelected && <CheckCircle2 className="mr-2 h-4 w-4" />}
        {isSelected ? t("versionCardCurrent") : t("versionCardSelect")}
      </Button>
    </div>
  );
}

export default function SegmentEditor() {
  const { storyId, segmentId } = Route.useParams();
  const { t } = useTranslation();
  const [promptText, setPromptText] = useState("");
  const [tuningPrompt, setTuningPrompt] = useState("");
  const prevIsGenerating = useRef<boolean | undefined>();

  const segment = useQuery(api.segments.get, {
    id: segmentId as Id<"segments">,
  });
  const versions = useQuery(api.imageVersions.getBySegment, {
    segmentId: segmentId as Id<"segments">,
  });

  const selectedVersion = segment?.selectedVersion;
  const imageUrl = useQuery(
    api.files.getFileUrl,
    selectedVersion?.image ? { storageId: selectedVersion.image } : "skip",
  );

  const { mutateAsync: regenerateImage, isPending: isRegenerating } =
    useMutation({
      mutationFn: useConvexMutation(api.segments.regenerateImage),
    });

  const { mutateAsync: editImage, isPending: isEditing } = useMutation({
    mutationFn: useConvexMutation(api.segments.editImage),
  });

  const { mutate: selectVersion, isPending: isSelecting } = useMutation({
    mutationFn: useConvexMutation(api.imageVersions.selectVersion),
    onSuccess: () => toast.success(t("toastVersionSelected")),
    onError: (err) => {
      toast.error(t("toastVersionSelectFailed"));
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
      toast.success(t("toastImageProcessed"));
    }
    prevIsGenerating.current = segment?.isGenerating;
  }, [segment?.isGenerating, segment?.error]);

  const handleRegenerate = async () => {
    if (!promptText.trim()) {
      toast.error(t("toastPromptEmpty"));
      return;
    }
    await regenerateImage({
      segmentId: segmentId as Id<"segments">,
      prompt: promptText,
    });
    toast.success(t("toastNewImageGenerationStarted"));
  };

  const handleEditImage = async () => {
    if (!tuningPrompt.trim()) {
      toast.error(t("toastEditPromptEmpty"));
      return;
    }
    if (!selectedVersion) {
      toast.error(t("toastNoVersionSelected"));
      return;
    }

    await editImage({
      segmentId: segmentId as Id<"segments">,
      prompt: tuningPrompt,
      versionIdToEdit: selectedVersion._id,
    });
    toast.success(t("toastImageEditStarted"));
    setTuningPrompt(""); // Clear input after submission
  };

  const isProcessing = segment?.isGenerating || isRegenerating || isEditing;

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
          {t("editSceneTitle", { order: segment ? segment.order + 1 : "" })}
        </h1>

        {segment === undefined && <div>{t("loading")}...</div>}

        {segment && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr,320px] gap-8 items-start">
            <div className="space-y-4">
              <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
                {imageUrl && !segment.isGenerating ? (
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
              <Tabs defaultValue="script" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="script">
                    <FileText className="mr-2 h-4 w-4" />
                    {t("tabScriptAndVoice")}
                  </TabsTrigger>
                  <TabsTrigger value="quick-edit">
                    <Bot className="mr-2 h-4 w-4" />
                    {t("tabQuickEdit")}
                  </TabsTrigger>
                  <TabsTrigger value="regenerate">
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t("tabRegenerate")}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="script">
                  <div className="overflow-hidden rounded-b-lg border border-t-0 bg-background">
                    <DialogueEditor segment={segment} />
                  </div>
                </TabsContent>
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
                        disabled={isProcessing || !selectedVersion}
                      />
                      {!selectedVersion && !isProcessing && (
                        <p className="text-xs text-amber-600 dark:text-amber-500">
                          {t("editPromptError")}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleEditImage}
                      disabled={isProcessing || !selectedVersion}
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
                  {versions === undefined && (
                    <div>{t("loadingVersionHistory")}...</div>
                  )}
                  {versions && versions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t("noVersionHistory")}
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
