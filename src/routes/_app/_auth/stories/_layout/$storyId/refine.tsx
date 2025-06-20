import { createFileRoute, Link } from "@tanstack/react-router";
import { TextEditor, useEditorCharacterCount } from "./-components/text-editor";
import { Id } from "~/convex/_generated/dataModel";
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
import { ArrowLeft, Smartphone, Monitor, Loader2, Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/ui/spinner";
import { useRefinePage } from "@/hooks/useRefinePage";

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
  const { t } = useTranslation();
  const charCount = useEditorCharacterCount(storyId);

  // All the complex page logic is now neatly encapsulated here.
  const {
    story,
    isLoading,
    isGenerateDialogOpen,
    setIsGenerateDialogOpen,
    format,
    setFormat,
    isGenerating,
    handleGenerateSegments,
  } = useRefinePage(storyId);

  // The component is now primarily responsible for rendering the UI.
  if (isLoading || !story) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col px-4 sm:px-6 lg:px-8 pb-4 md:pb-8">
        <header className="flex-shrink-0 pt-2">
          <div className="mb-4">
            <Button variant="ghost" size="sm" asChild className="-ml-3">
              <Link to="/stories/$storyId" params={{ storyId }}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("backToStoryDetails")}
              </Link>
            </Button>
          </div>
          <div className="space-y-2">
            <EditableTitle storyId={storyId} initialTitle={story.title} />
            <div className="text-muted-foreground text-xs">
              <span>
                {t("lastUpdated")}{" "}
                {new Date(story.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col mt-6 min-h-0">
          <div className="flex-1 w-full relative">
            <TextEditor id={storyId} />
          </div>
          <footer className="flex-shrink-0 py-2 border-t text-xs text-muted-foreground flex justify-between items-center">
            <span>
              {t("characterCount")} {charCount}
            </span>
          </footer>
        </main>
      </div>

      <div className="fixed bottom-8 right-8 z-50">
        <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  className="h-12 w-auto px-6 shadow-lg rounded-full"
                  onClick={() => setIsGenerateDialogOpen(true)}
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  {t("generateSegments")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("generateSegmentsTooltip")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader className="space-y-2">
              <DialogTitle>{t("chooseVideoOrientation")}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {t("orientationDescription")}
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
                  {t("orientationVertical")}
                </Button>
                <Button
                  variant={format === "horizontal" ? "default" : "outline"}
                  onClick={() => setFormat("horizontal")}
                  className="flex-1 flex items-center justify-center gap-2 h-12"
                >
                  <Monitor className="h-5 w-5" />
                  {t("orientationHorizontal")}
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground/80 text-center border rounded-md p-3 bg-muted/50">
                {t("orientationWarning")}
              </p>
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="flex-1">
                  {t("cancel")}
                </Button>
              </DialogClose>
              <Button
                type="button"
                className="flex-1"
                onClick={handleGenerateSegments}
                disabled={isGenerating}
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isGenerating ? t("processing") : t("confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}