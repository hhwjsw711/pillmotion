import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Button } from "@/ui/button";
import { Clapperboard, Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { StoryCard } from "./-components/story-card";
import { StoryCardSkeleton } from "./-components/story-card-skeleton";
import { CreateStoryDialog } from "./-components/create-story-dialog";
import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/alert-dialog";
import { Id, Doc } from "~/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/tabs";
import { useStoryActions } from "~/src/hooks/useStoryActions";

type StoryStatusTab = Doc<"story">["status"] | "all";

export const Route = createFileRoute("/_app/_auth/stories/_layout/")({
  component: StoriesPage,
});

export function StoriesPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<StoryStatusTab>("all");
  const stories = useQuery(api.story.list, {
    status: activeTab === "all" ? undefined : activeTab,
  });
  const navigate = useNavigate();
  const [storyToDelete, setStoryToDelete] = React.useState<Id<"story"> | null>(
    null,
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  const { deleteStory, isDeleting, updateStatus, isUpdatingStatus } =
    useStoryActions();

  const { mutateAsync: createStory, isPending: isCreating } = useMutation({
    mutationFn: useConvexMutation(api.story.createStory),
  });
  const { mutateAsync: initializeEditor, isPending: isInitializing } =
    useMutation({
      mutationFn: useConvexMutation(api.story.initializeEditor),
    });

  const isPendingCreation = isCreating || isInitializing;

  const handleCreateStory = async ({
    title,
    script,
  }: {
    title?: string;
    script?: string;
  }) => {
    const toastId = toast.loading(t("creatingStory"));
    try {
      const storyId = await createStory({
        title: title || t("untitledStory"),
        script,
      });
      toast.loading(t("initializingEditor"), { id: toastId });
      await initializeEditor({ storyId });
      toast.success(t("storyCreatedSuccess"), { id: toastId });
      setIsCreateDialogOpen(false);
      navigate({
        to: "/stories/$storyId/refine",
        params: { storyId },
      });
    } catch (error) {
      const err = error as Error;
      toast.error(t("storyCreatedError"), {
        id: toastId,
        description: err.message,
      });
      console.error("Failed to create story:", err);
    }
  };

  const handleDeleteRequest = (storyId: Id<"story">) => {
    setStoryToDelete(storyId);
  };

  const confirmDelete = () => {
    if (storyToDelete) {
      deleteStory(storyToDelete);
      setStoryToDelete(null);
    }
  };

  const renderContent = () => {
    if (stories === undefined) {
      return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <StoryCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (stories.length === 0) {
      if (activeTab === "all") {
        return (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
            <Clapperboard className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="text-xl font-semibold">
              {t("startYourCreationJourney")}
            </h2>
            <p className="mt-1 text-muted-foreground">
              {t("noStoriesYetDescription")}
            </p>
            <Button
              className="mt-4"
              onClick={() => setIsCreateDialogOpen(true)}
              disabled={isPendingCreation}
            >
              {isPendingCreation ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="mr-2 h-4 w-4" />
              )}
              {t("startYourFirstStory")}
            </Button>
          </div>
        );
      } else {
        return (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
            <Clapperboard className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="text-xl font-semibold">
              {t("noStoriesInThisCategory")}
            </h2>
            <p className="mt-1 text-muted-foreground">
              {t("tryDifferentCategoryOrCreate")}
            </p>
          </div>
        );
      }
    }

    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stories.map((story) => (
          <StoryCard
            key={story._id}
            story={story}
            showActionsMenu={true}
            onDelete={handleDeleteRequest}
            onUpdateStatus={updateStatus}
            isUpdatingStatus={isUpdatingStatus}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="container mx-auto max-w-7xl px-4 pt-8 pb-12">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t("myStories")}</h1>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={isPendingCreation}
          >
            {isPendingCreation ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            {t("createNewStory")}
          </Button>
        </header>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as StoryStatusTab)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4 sm:max-w-md">
            <TabsTrigger value="all">{t("statusAll")}</TabsTrigger>
            <TabsTrigger value="draft">{t("statusDraft")}</TabsTrigger>
            <TabsTrigger value="published">{t("statusPublished")}</TabsTrigger>
            <TabsTrigger value="archived">{t("statusArchived")}</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-6">
            {renderContent()}
          </TabsContent>
        </Tabs>
      </div>
      <AlertDialog
        open={!!storyToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setStoryToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDeleteStoryTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteStoryDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CreateStoryDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateStory={handleCreateStory}
        isPending={isPendingCreation}
      />
    </>
  );
}
