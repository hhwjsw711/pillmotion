import { Skeleton } from "@/ui/skeleton";

/**
 * A skeleton loader component that mimics the layout of a SegmentCard.
 * It's used to provide a better loading experience on the story detail page.
 */
export function SegmentCardSkeleton() {
    return (
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <div className="flex items-center gap-1">
            <Skeleton className="h-7 w-7" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-7 w-7 rounded-full" />
        </div>
        <Skeleton className="aspect-video w-full" />
        <div className="p-3">
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }