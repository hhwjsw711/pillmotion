import { useState, useEffect } from "react";
import { Doc, Id } from "~/convex/_generated/dataModel";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { api } from "~/convex/_generated/api";
import { Button } from "@/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { Label } from "@/ui/label";
import { Input } from "@/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Film, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TRANSITION_TYPES } from "~/convex/schema";
import { useTranslation } from "react-i18next";

type Transition = Doc<"transitions">;

interface TransitionEditorProps {
  storyId: Id<"story">;
  afterSegmentId: Id<"segments">;
  order: number;
  transition?: Transition;
}

export function TransitionEditor({
  storyId,
  afterSegmentId,
  order,
  transition,
}: TransitionEditorProps) {
  const { t } = useTranslation();
  const [type, setType] = useState<Transition["type"]>(
    transition?.type ?? "cut",
  );
  const [duration, setDuration] = useState(transition?.duration ?? 0);
  const [isOpen, setIsOpen] = useState(false);

  const upsertMutation = useConvexMutation(api.transitions.upsertTransition);
  const { mutate: upsert, isPending } = useMutation({
    mutationFn: (vars: { type: Transition["type"]; duration: number }) =>
      upsertMutation({
        storyId,
        afterSegmentId,
        type: vars.type,
        duration: vars.duration,
      }),
    onSuccess: () => {
      toast.success(t("toastTransitionUpdated", { order: order + 1 }));
      setIsOpen(false);
    },
    onError: (err) =>
      toast.error(t("toastTransitionUpdateFailed"), {
        description: err.message,
      }),
  });

  useEffect(() => {
    setType(transition?.type ?? "cut");
    setDuration(transition?.duration ?? 0);
  }, [transition]);

  const handleSave = () => {
    if (
      type === "cut" &&
      (transition?.type === undefined || transition.type === "cut")
    ) {
      setIsOpen(false);
      return;
    }

    if (type !== "cut" && duration < 100) {
      toast.warning(t("toastTransitionDurationWarning"));
    }
    upsert({ type, duration });
  };

  const displayType = transition?.type ?? "cut";
  const displayDuration = transition?.duration ?? 0;

  return (
    <div className="h-8 flex items-center justify-center w-full my-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dashed group"
          >
            <Film className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-muted-foreground group-hover:text-primary transition-colors text-xs">
              {`${displayType.charAt(0).toUpperCase() + displayType.slice(1)} (${displayDuration}ms)`}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">
                {t("transitionSettingsTitle")}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t("transitionSettingsDescription", { order: order + 1 })}
              </p>
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-3 items-center gap-4">
                <Label htmlFor="type">{t("transitionTypeLabel")}</Label>
                <Select
                  value={type}
                  onValueChange={(value) =>
                    setType(value as Transition["type"])
                  }
                >
                  <SelectTrigger id="type" className="col-span-2 h-8">
                    <SelectValue placeholder={t("transitionTypePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSITION_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label htmlFor="duration">{t("transitionDurationLabel")}</Label>
                <Input
                  id="duration"
                  type="number"
                  step={50}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="col-span-2 h-8"
                  disabled={type === "cut"}
                />
              </div>
            </div>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
