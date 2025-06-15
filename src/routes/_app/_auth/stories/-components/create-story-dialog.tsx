import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Textarea } from "@/ui/textarea";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { useTranslation } from "react-i18next";
import React from "react";
import { Loader2 } from "lucide-react";

interface CreateStoryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCreateStory: (args: { title?: string; script?: string }) => Promise<void>;
  isPending: boolean;
}

export function CreateStoryDialog({
  isOpen,
  onOpenChange,
  onCreateStory,
  isPending,
}: CreateStoryDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = React.useState("");
  const [script, setScript] = React.useState("");

  const handleCreateWithText = () => {
    onCreateStory({ title: title || undefined, script });
  };

  const handleCreateBlank = () => {
    // Reset fields in case user typed something then changed their mind
    setTitle("");
    setScript("");
    onCreateStory({});
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] md:max-w-screen-sm">
        <DialogHeader>
          <DialogTitle>{t("createNewStoryDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("createNewStoryDialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="title">{t("storyTitleOptionalLabel")}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="script">{t("pasteStoryPlaceholder")}</Label>
            <Textarea
              id="script"
              placeholder={t("pasteStoryPlaceholder")}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="min-h-[200px]"
              disabled={isPending}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleCreateBlank}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("createBlankStoryButton")}
          </Button>
          <Button
            type="button"
            onClick={handleCreateWithText}
            disabled={!script || isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("createWithTextButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
