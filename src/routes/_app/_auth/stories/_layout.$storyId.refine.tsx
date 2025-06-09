import { createFileRoute } from "@tanstack/react-router";
import { TextEditor } from "./-components/text-editor";
import { Id } from "~/convex/_generated/dataModel";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { cn } from "@/utils/misc";
import { EditableTitle } from "./-components/editable-title";

export const Route = createFileRoute("/_app/_auth/stories/_layout/$storyId/refine")({
  component: RefineStory,
  loader: ({ params: { storyId } }) => {
    return { storyId };
  },
  errorComponent: ({ error }) => <div>Error: {error.message}</div>,
});

export default function RefineStory() {
  const { storyId } = Route.useParams();
  const { data: story } = useQuery(
    convexQuery(api.story.getStory, {
      storyId: storyId as Id<"story">,
    }),
  );

  return (
    <div className="flex h-full justify-center py-4 md:py-8">
      <div className={cn("flex h-full w-full max-w-4xl flex-col")}>
        {story && (
          <EditableTitle
            storyId={storyId as Id<"story">}
            initialTitle={story.title}
          />
        )}
        <div className="mb-2 px-4 text-muted-foreground text-xs md:px-8">
          <span>
            最后更新:{" "}
            {story?.updatedAt && new Date(story.updatedAt).toLocaleString()}
          </span>
        </div>
        <div className="relative w-full flex-1">
          <div
            className={cn(
              "h-full w-full resize-none whitespace-pre-wrap bg-transparent px-4 font-serif text-base outline-none placeholder:text-muted-foreground/50 md:px-8",
            )}
          >
            <TextEditor
              id={storyId as Id<"story">}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
