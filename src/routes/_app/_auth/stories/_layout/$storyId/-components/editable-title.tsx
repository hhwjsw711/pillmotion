import { Input } from "@/ui/input";
import { Id } from "~/convex/_generated/dataModel";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEditableTitle } from "@/hooks/useEditableTitle";

export function EditableTitle({
  storyId,
  initialTitle,
}: {
  storyId: Id<"story">;
  initialTitle: string;
}) {
  const { t } = useTranslation();
  const { isPending, isSuccess, handleTitleChange } = useEditableTitle(
    storyId,
    initialTitle,
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        defaultValue={initialTitle}
        onKeyDown={handleKeyDown}
        onBlur={(e) => handleTitleChange(e.target.value)}
        disabled={isPending}
        className="w-full !text-2xl h-auto border-none bg-transparent p-0 font-semibold focus-visible:ring-0"
        aria-label={t("ariaLabelStoryTitle")}
      />
      <div className="h-6 w-6">
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : isSuccess ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : null}
      </div>
    </div>
  );
}