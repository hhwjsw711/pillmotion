import { createFileRoute, Link } from "@tanstack/react-router";
import { Id } from "~/convex/_generated/dataModel";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { ArrowLeft, Loader2, Wand2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStyleEditor, AutoSaveStatus } from "@/hooks/useStyleEditor";

export const Route = createFileRoute(
  "/_app/_auth/stories/_layout/$storyId/style",
)({
  component: StyleEditor,
  loader: ({ params: { storyId } }) => {
    return { storyId: storyId as Id<"story"> };
  },
});

function AutoSaveIndicator({ status }: { status: AutoSaveStatus }) {
  const { t } = useTranslation();

  if (status === "idle") {
    return null;
  }

  const statusConfig = {
    saving: {
      icon: <Loader2 className="mr-2 h-4 w-4 animate-spin" />,
      text: t("statusSaving"),
      className: "text-muted-foreground",
    },
    success: {
      icon: <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />,
      text: t("statusAllChangesSaved"),
      className: "text-green-600",
    },
    error: {
      icon: <AlertTriangle className="mr-2 h-4 w-4 text-red-500" />,
      text: t("statusSaveChangesFailed"),
      className: "text-red-600",
    },
  };

  const config = statusConfig[status];
  if (!config) return null;

  return (
    <div className={`flex items-center text-sm ${config.className}`}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
}


export default function StyleEditor() {
  const { storyId } = Route.useLoaderData();
  const { t } = useTranslation();

  const {
    isStoryLoading,
    stylePrompt,
    setStylePrompt,
    saveStatus,
  } = useStyleEditor(storyId);

  if (isStoryLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-4 md:pb-8">
      <header className="mb-6">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link to="/stories/$storyId" params={{ storyId }}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("backToStoryDetails")}
            </Link>
          </Button>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{t("styleStudioTitle")}</h1>
          <p className="text-muted-foreground">
            {t("styleStudioSimpleDescription")}
          </p>
        </div>
      </header>

      <main className="space-y-6">
        <section className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="style_prompt" className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              {t("visualStylePromptLabel")}
            </Label>
            <Textarea
              id="style_prompt"
              rows={8}
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              placeholder={t("visualStylePromptPlaceholder")}
              className="text-base"
              disabled={saveStatus === "saving"}
            />
            <p className="text-xs text-muted-foreground">
              {t("visualStylePromptHint")}
            </p>
          </div>
        </section>

        <footer className="flex justify-end gap-3 pt-4 border-t">
          <AutoSaveIndicator status={saveStatus} />
        </footer>
      </main>
    </div>
  );
}