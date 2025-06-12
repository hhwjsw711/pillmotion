import { createFileRoute, Link } from "@tanstack/react-router";
import { SegmentCard } from "../../-components/segment-card";
import { useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Doc, Id } from "~/convex/_generated/dataModel";
import { Spinner } from "@/ui/spinner";

export const Route = createFileRoute("/_app/_auth/stories/_layout/$storyId/")({
  component: Story,
});

export default function Story() {
  const { storyId } = Route.useParams();
  const story = useQuery(api.story.getStory, {
    storyId: storyId as Id<"story">,
  });

  if (story === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  if (story === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">未找到该故事。</div>
      </div>
    );
  }

  return (
    <div className="flex h-full justify-center py-4 md:py-8">
      <div className="flex h-full w-full max-w-6xl flex-col space-y-8">
        <StorySection story={story} />
      </div>
    </div>
  );
}

function StorySection({ story }: { story: Doc<"story"> }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {story.title}
          </h2>
          {story.generationStatus === "processing" && (
            <span className="flex items-center gap-1 text-sm text-blue-500">
              <Spinner />
              生成中...
            </span>
          )}
          {story.generationStatus === "error" && (
            <span className="text-sm text-red-500">生成失败</span>
          )}
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {new Date(story.updatedAt).toLocaleDateString("zh-CN")}
        </span>
      </div>
      <StorySegments story={story} />
    </div>
  );
}

function StorySegments({ story }: { story: Doc<"story"> }) {
  const { _id: storyId, generationStatus } = story;
  const segments = useQuery(api.segments.getByStory, { storyId });

  if (segments === undefined) {
    return (
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"
          />
        ))}
      </div>
    );
  }

  if (segments.length === 0) {
    if (generationStatus === "processing") {
      return (
        <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p>正在为您拆分剧本并生成场景...</p>
          </div>
        </div>
      );
    }

    if (generationStatus === "completed") {
      return (
        <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p>故事为空或无法拆分场景。</p>
            <Link
              to="/stories/$storyId/refine"
              params={{ storyId }}
              className="mt-1 inline-block text-blue-500 hover:underline"
            >
              前往编辑器完善您的故事
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <div className="text-gray-500 dark:text-gray-400">
          这个故事还没有生成任何场景
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
      {segments.map((segment) => (
        <SegmentCard key={segment._id} segment={segment} />
      ))}
    </div>
  );
}
