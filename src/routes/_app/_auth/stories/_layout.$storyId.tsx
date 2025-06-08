import { createFileRoute } from "@tanstack/react-router";
import { TextEditor } from "./-components/text-editor";
import { Id } from "~/convex/_generated/dataModel";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { cn } from "@/utils/misc";
import { EditableTitle } from "./-components/editable-title";

export const Route = createFileRoute("/_app/_auth/stories/_layout/$storyId")({
  component: StoryLayout,
  loader: ({ params: { storyId } }) => {
    return { storyId };
  },
  errorComponent: ({ error }) => <div>Error: {error.message}</div>,
});

export default function StoryLayout() {
  const { storyId } = Route.useParams();
  const { data: story } = useQuery(convexQuery(api.story.getStory, {
    storyId: storyId as Id<"story">
  }));

  return (
    <div className="flex h-full justify-center py-8">
      <div className={cn("flex h-full w-full max-w-4xl flex-col")}>
        {story && (
          <EditableTitle
            storyId={storyId as Id<"story">}
            initialTitle={story.title}
          />
        )}
        <div className="mb-2 px-8 text-muted-foreground text-xs">
          最后更新:{" "}
          {story?.updatedAt && new Date(story.updatedAt).toLocaleString()}
        </div>
        <div className="relative h-[calc(100%-2rem)] w-full flex-1">
          <div
            className={cn(
              "h-[calc(100%-2rem)] w-full flex-1 resize-none whitespace-pre-wrap bg-transparent px-8 font-serif text-base outline-none placeholder:text-muted-foreground/50",
            )}
          >
            <TextEditor id={storyId as Id<"story">} />
          </div>
        </div>
      </div>
    </div>
  );
}
