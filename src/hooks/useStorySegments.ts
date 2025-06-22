import { useState, useEffect } from "react";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "~/convex/_generated/api";
import { Id, Doc } from "~/convex/_generated/dataModel";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useSensor, PointerSensor, DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { convexQuery } from "@convex-dev/react-query";

// [FIXED] The type inference using `._implementation` was based on internal Convex
// details and has broken in a newer version. The most robust approach is to
// explicitly define the type based on the return shape of the
// `api.segments.getSegmentsWithPreview` query.
type SegmentWithImageUrl = Doc<"segments"> & {
  previewImageUrl: string | null;
};

/**
 * Custom hook to manage all logic related to a story's segments.
 * This includes fetching, reordering, and adding new segments.
 * @param storyId The ID of the story whose segments are to be managed.
 */
export function useStorySegments(storyId: Id<"story">) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // [FIXED] Use the new, correct query.
  const query = convexQuery(api.segments.getSegmentsWithPreview, { storyId });
  const { data: segmentsData, isLoading } = useQuery(query);

  const [activeSegments, setActiveSegments] = useState<SegmentWithImageUrl[]>(
    [],
  );
  useEffect(() => {
    if (segmentsData) {
      setActiveSegments(segmentsData);
    }
  }, [segmentsData]);

  const reorderMutation = useConvexMutation(api.segments.reorderSegments);
  const { mutate: reorderSegments } = useMutation({
    mutationFn: async (orderedIds: Id<"segments">[]) => {
      await reorderMutation({ storyId, segmentIds: orderedIds });
    },
    onSuccess: () => {
      toast.success(t("toastOrderSaved"));
      // Invalidate query to refetch the new order from the server
      queryClient.invalidateQueries({ queryKey: query.queryKey });
    },
    onError: (err) => {
      toast.error(t("toastOrderSaveFailed"), {
        description: err instanceof Error ? err.message : t("unknownError"),
      });
      if (segmentsData) setActiveSegments(segmentsData); // Revert on error
    },
  });

  const addSegmentMutation = useConvexMutation(api.segments.addSegment);
  const { mutate: addSegment, isPending: isAdding } = useMutation({
    mutationFn: async () => {
      const newSegmentId = await addSegmentMutation({ storyId });
      if (!newSegmentId) throw new Error("Backend did not return a new ID.");
      return newSegmentId;
    },
    onSuccess: (newSegmentId) => {
      toast.success(t("toastSegmentAdded"));
      // Invalidate the list so it shows the new segment
      queryClient.invalidateQueries({ queryKey: query.queryKey });
      navigate({
        to: "/stories/$storyId/segments/$segmentId",
        params: { storyId, segmentId: newSegmentId },
      });
    },
    onError: (err) => {
      toast.error(t("toastSegmentAddFailed"), {
        description: err instanceof Error ? err.message : t("unknownError"),
      });
    },
  });

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setActiveSegments((items) => {
        const oldIndex = items.findIndex((item) => item._id === active.id);
        const newIndex = items.findIndex((item) => item._id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        reorderSegments(newOrder.map((item) => item._id));
        return newOrder;
      });
    }
  }

  return {
    segmentsData: activeSegments, // Return the stateful list for optimistic updates
    isLoading,
    isAdding,
    addSegment,
    handleDragEnd,
    pointerSensor,
  };
}
