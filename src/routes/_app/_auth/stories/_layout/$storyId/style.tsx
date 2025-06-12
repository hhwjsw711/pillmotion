import { createFileRoute, Link } from "@tanstack/react-router";
import { Id } from "~/convex/_generated/dataModel";
import { useQuery, useMutation } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Input } from "@/ui/input";
import {
  ArrowLeft,
  Loader2,
  Save,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute(
  "/_app/_auth/stories/_layout/$storyId/style",
)({
  component: StyleEditor,
  loader: ({ params: { storyId } }) => {
    return { storyId: storyId as Id<"story"> };
  },
});

// Zod schema for robust validation of the context JSON
const StyleBibleSchema = z.object({
  visual_theme: z.string(),
  mood: z.string(),
  color_palette: z.union([z.array(z.string()), z.string()]), // Allow both array and string
  lighting_style: z.string(),
  character_design: z.string(),
  environment_design: z.string(),
});
const ContextSchema = z.object({
  story_outline: z.string(),
  style_bible: StyleBibleSchema,
});
type ContextData = z.infer<typeof ContextSchema>;

const initialContext: ContextData = {
  story_outline: "",
  style_bible: {
    visual_theme: "",
    mood: "",
    color_palette: "",
    lighting_style: "",
    character_design: "",
    environment_design: "",
  },
};

export default function StyleEditor() {
  const { storyId } = Route.useLoaderData();

  const { data: story } = useQuery(
    convexQuery(api.story.getStory, { storyId }),
  );
  const [contextData, setContextData] = useState<ContextData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (story?.context) {
      try {
        const parsed = JSON.parse(story.context);
        const result = ContextSchema.safeParse(parsed);
        if (result.success) {
          setContextData(result.data);
          setParseError(null);
        } else {
          setParseError("JSON 结构不匹配，请检查或重新生成。");
          console.error("Zod validation error:", result.error);
          setContextData(initialContext);
        }
      } catch (e) {
        setParseError("JSON 解析失败，内容可能已损坏。");
        console.error("JSON parse error:", e);
        setContextData(initialContext);
      }
    } else if (story) {
      // If context is empty, initialize with the form structure
      setContextData(initialContext);
    }
  }, [story]);

  const updateContextMutation = useConvexMutation(api.story.updateStoryContext);
  const { mutate: updateContext, isPending: isUpdating } = useMutation({
    mutationFn: async (data: ContextData) => {
      await updateContextMutation({
        storyId,
        context: JSON.stringify(data, null, 2), // Pretty print JSON
      });
    },
    onSuccess: () => toast.success("风格指南已保存！"),
    onError: (err) => toast.error(`保存失败: ${err.message}`),
  });

  const handleSave = () => {
    if (contextData) {
      updateContext(contextData);
    }
  };

  if (contextData === null) {
    return <div>加载中...</div>;
  }

  const handleInputChange = (
    field:
      | keyof ContextData
      | `style_bible.${keyof ContextData["style_bible"]}`,
    value: string,
  ) => {
    setContextData((prev) => {
      if (!prev) return null;
      // Deep copy to avoid direct state mutation
      const newData = JSON.parse(JSON.stringify(prev));

      if (field.startsWith("style_bible.")) {
        const key = field.split(".")[1] as keyof ContextData["style_bible"];
        newData.style_bible[key] = value;
      } else {
        (newData[field as keyof ContextData] as any) = value;
      }
      return newData;
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-4 md:pb-8">
      <header className="mb-6">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link to="/stories/$storyId" params={{ storyId }}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回故事详情
            </Link>
          </Button>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">创作风格工作室</h1>
          <p className="text-muted-foreground">
            在这里精细调整故事的视觉风格和核心大纲，AI
            将严格遵循这些设定来生成图片。
          </p>
        </div>
      </header>

      {parseError && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <p className="text-sm">{parseError}</p>
        </div>
      )}

      <main className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">故事大纲</h2>
          <div className="grid gap-2">
            <Label htmlFor="story_outline">
              剧情概要 (AI 将理解这段核心剧情)
            </Label>
            <Textarea
              id="story_outline"
              rows={5}
              value={contextData.story_outline}
              onChange={(e) =>
                handleInputChange("story_outline", e.target.value)
              }
              placeholder="一段关于..."
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">视觉风格指南</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {Object.entries(contextData.style_bible).map(([key, value]) => {
              const isColorPalette = key === "color_palette";
              const displayValue =
                isColorPalette && Array.isArray(value)
                  ? value.join(", ")
                  : value;

              return (
                <div className="grid gap-2" key={key}>
                  <Label htmlFor={key} className="capitalize">
                    {key.replace("_", " ")}
                  </Label>
                  <Input
                    id={key}
                    value={displayValue}
                    placeholder={
                      isColorPalette
                        ? "例如: navy blue, goldenrod, crimson"
                        : "..."
                    }
                    onChange={(e) => {
                      const newValue = isColorPalette
                        ? e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s) // Trim and remove empty strings
                        : e.target.value;
                      handleInputChange(
                        `style_bible.${
                          key as keyof ContextData["style_bible"]
                        }`,
                        newValue as any,
                      );
                    }}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <footer className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" disabled>
            <Sparkles className="mr-2 h-4 w-4" />用 AI 重新生成
          </Button>
          <Button onClick={handleSave} disabled={isUpdating}>
            {isUpdating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            保存风格指南
          </Button>
        </footer>
      </main>
    </div>
  );
}
