import { Input } from "@/ui/input";
import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function EditableTitle({
  storyId,
  initialTitle,
}: {
  storyId: Id<"story">;
  initialTitle: string;
}) {
  const { t } = useTranslation();
  const [isSuccess, setIsSuccess] = useState(false);
  const { mutate, isPending } = useMutation({
    mutationFn: useConvexMutation(api.story.updateStoryTitle),
    onSuccess: () => {
      setIsSuccess(true);
      const timer = setTimeout(() => setIsSuccess(false), 2000);
      return () => clearTimeout(timer);
    },
    onError: (err) => {
      toast.error(t("toastTitleUpdateFailed"), {
        description: err.message,
      });
    },
  });

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
        onBlur={(e) => {
          const newTitle = e.target.value.trim();
          if (newTitle && newTitle !== initialTitle) {
            mutate({ storyId, title: newTitle });
          }
        }}
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
