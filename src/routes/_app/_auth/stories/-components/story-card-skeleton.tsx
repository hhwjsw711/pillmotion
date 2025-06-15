import { Skeleton } from "@/ui/skeleton";

export function StoryCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card">
      {/* Mimics the thumbnail */}
      <Skeleton className="h-auto w-full aspect-video" />
      {/* Mimics the content area */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="space-y-2">
          {/* Title placeholder */}
          <Skeleton className="h-5 w-3/4" />
          {/* Status placeholder */}
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="mt-4">
          {/* "Last updated" placeholder */}
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    </div>
  );
}