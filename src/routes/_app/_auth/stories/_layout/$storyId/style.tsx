import { createFileRoute, Link } from "@tanstack/react-router";
import { Id } from "~/convex/_generated/dataModel";
import { useQuery, useMutation } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { ArrowLeft, Loader2, Save, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute(
  "/_app/_auth/stories/_layout/$storyId/style",
)({
  component: StyleEditor,
  loader: ({ params: { storyId } }) => {
    return { storyId: storyId as Id<"story"> };
  },
});

export default function StyleEditor() {
  const { storyId } = Route.useLoaderData();
  const { t } = useTranslation();

  const { data: story, isLoading: isStoryLoading } = useQuery(
    convexQuery(api.story.getStory, { storyId }),
  );

  const [stylePrompt, setStylePrompt] = useState("");

  useEffect(() => {
    if (story?.stylePrompt) {
      setStylePrompt(story.stylePrompt);
    }
  }, [story]);

  const updateStylePromptMutation = useConvexMutation(
    api.story.updateStylePrompt,
  );
  const { mutate: updateStylePrompt, isPending: isUpdating } = useMutation({
    mutationFn: async (newPrompt: string) => {
      await updateStylePromptMutation({
        storyId,
        stylePrompt: newPrompt,
      });
    },
    onSuccess: () => toast.success(t("toastStyleSaved")),
    onError: (err) =>
      toast.error(t("toastStyleSaveFailed", { error: err.message })),
  });

  const handleSave = () => {
    updateStylePrompt(stylePrompt);
  };

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
            />
            <p className="text-xs text-muted-foreground">
              {t("visualStylePromptHint")}
            </p>
          </div>
        </section>

        <footer className="flex justify-end gap-3 pt-4 border-t">
          <Button onClick={handleSave} disabled={isUpdating}>
            {isUpdating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t("buttonSaveChanges")}
          </Button>
        </footer>
      </main>
    </div>
  );
}
