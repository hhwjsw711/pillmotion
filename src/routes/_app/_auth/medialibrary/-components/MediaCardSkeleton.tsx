import { Skeleton } from "@/ui/skeleton";

export function MediaCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      <Skeleton className="h-56 w-full" />
      <div className="p-2">
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}