import { Input } from "@/ui/input";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "~/convex/_generated/api";
import { useConvexMutation } from "@convex-dev/react-query";
import { Id } from "~/convex/_generated/dataModel";
import { toast } from "sonner";

interface EditableTitleProps {
  storyId: Id<"story">;
  initialTitle: string;
}

export function EditableTitle({ storyId, initialTitle }: EditableTitleProps) {
  const [isPending, setIsPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateTitle = useConvexMutation(api.story.updateStoryTitle);

  const { mutate } = useMutation({
    mutationFn: async (title: string) => {
      await updateTitle({ storyId, title });
    },
    onSuccess: () => {
      toast.success("标题已更新");
      if (inputRef.current) {
        inputRef.current.blur();
      }
    },
    onError: (error) => {
      toast.error("更新失败：" + error.message);
    }
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setIsPending(true);
      mutate(e.currentTarget.value, {
        onSettled: () => setIsPending(false)
      });
    }
  };

  return (
    <div className="mb-2 px-4 md:px-8">
      <Input
        ref={inputRef}
        defaultValue={initialTitle}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          if (e.target.value !== initialTitle) {
            setIsPending(true);
            mutate(e.target.value, {
              onSettled: () => setIsPending(false)
            });
          }
        }}
        disabled={isPending}
        className="!text-2xl h-8 border-none bg-transparent p-0 font-semibold focus-visible:ring-0"
        aria-label="故事标题"
      />
    </div>
  );
}