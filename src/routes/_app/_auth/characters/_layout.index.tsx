import { createFileRoute } from "@tanstack/react-router";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { Input } from "@/ui/input";
import { Skeleton } from "@/ui/skeleton";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConvexMutation, convexQuery } from "@convex-dev/react-query";
import { useUploadFiles } from "@xixixao/uploadstuff/react";
import {
  Ellipsis,
  Plus,
  Trash,
  Image as LucideImage,
  Loader,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import JSZip from "jszip";
import { CharacterForList } from "~/convex/characters";
import { ConvexError } from "convex/values";

// Shadcn UI Form Imports
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const listCharactersQuery = convexQuery(api.characters.list, {});

export const Route = createFileRoute("/_app/_auth/characters/_layout/")({
  component: CharactersPage,
});

// =================================================================================
// 1. Main Page Component
// =================================================================================
export function CharactersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: characters, isLoading: charactersIsLoading } =
    useQuery(listCharactersQuery);

  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const toastIdRef = useRef<string | number | undefined>(undefined);
  const characterNameRef = useRef(""); // <--- 1. 添加 Ref 来存储名称

  const createCharacterMutation = useMutation({
    mutationFn: useConvexMutation(api.characters.create),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listCharactersQuery.queryKey });
      setCreateDialogOpen(false);
      toast.success(t("characters.toast.createSuccess"), {
        id: toastIdRef.current,
      });
    },
    onError: (error) => {
      toast.error(t("characters.toast.createError"), {
        id: toastIdRef.current,
        description: error instanceof ConvexError ? error.data : error.message,
      });
    },
  });

  const generateUploadUrlMutation = useMutation({
    mutationFn: useConvexMutation(api.app.generateUploadUrl),
  });

  // 移除 useUploadFiles 上的泛型，因为我们不再使用 options
  const uploader = useUploadFiles(
    () => generateUploadUrlMutation.mutateAsync({}),
    {
      onUploadComplete: async (results) => {
        toast.loading(t("characters.toast.createInProgress"), {
          id: toastIdRef.current,
        });
        const coverImageId = (
          results[0].response as { storageId: Id<"_storage"> }
        ).storageId;
        const trainingDataZipId = (
          results[1].response as { storageId: Id<"_storage"> }
        ).storageId;

        // 3. 从 Ref 中安全地读取名称
        const characterName = characterNameRef.current;

        await createCharacterMutation.mutateAsync({
          name: characterName,
          coverImageId,
          trainingDataZipId,
        });
      },
      onUploadError: (error) => {
        toast.error(t("characters.toast.uploadError"), {
          id: toastIdRef.current,
          description:
            error instanceof ConvexError
              ? error.data
              : (error as Error).message,
        });
      },
    },
  );

  const handleCreateCharacter = async (name: string, files: File[]) => {
    toastIdRef.current = toast.loading(t("characters.toast.uploading"), {
      duration: Infinity,
    });

    // 2. 在上传前，将名称存入 Ref
    characterNameRef.current = name;

    const zip = new JSZip();
    files.forEach((file) => zip.file(file.name, file));
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const zipFile = new File(
      [zipBlob],
      `${name.replace(/\s+/g, "_")}_training_data.zip`,
      { type: "application/zip" },
    );
    const coverImageFile = files[0];

    // 4. 调用 startUpload 时，只传递文件数组
    uploader.startUpload([coverImageFile, zipFile]);
  };

  const isProcessing =
    createCharacterMutation.isPending || uploader.isUploading;
  const isPending = charactersIsLoading || isProcessing;

  return (
    <div className="container mx-auto max-w-7xl px-4 pt-8 pb-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("characters.title")}</h1>
        <Button onClick={() => setCreateDialogOpen(true)} disabled={isPending}>
          {isPending ? (
            <Loader className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {t("characters.buttons.new")}
        </Button>
      </header>

      {charactersIsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <CharacterCardSkeleton key={i} />
          ))}
        </div>
      ) : characters?.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
          <LucideImage className="mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">
            {t("characters.empty.title")}
          </h2>
          <p className="mt-1 text-muted-foreground">
            {t("characters.empty.description")}
          </p>
          <Button
            className="mt-4"
            onClick={() => setCreateDialogOpen(true)}
            disabled={isPending}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("characters.buttons.createFirst")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {characters?.map((character) => (
            <CharacterCard key={character._id} character={character} />
          ))}
        </div>
      )}

      <CreateNewCharacterDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreateCharacter}
        isCreating={isProcessing}
      />
    </div>
  );
}

// =================================================================================
// 2. Create New Character Dialog Component
// =================================================================================
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB

const formSchema = z.object({
  name: z.string().min(1, { message: "characters.form.error.nameRequired" }),
  files: z
    .custom<FileList>()
    .refine(
      (files) => files && files.length > 0,
      "characters.form.error.filesRequired",
    )
    .refine(
      (files) => files && files.length >= 10 && files.length <= 20,
      "characters.form.error.fileCount",
    )
    .refine(
      (files) =>
        files &&
        Array.from(files).every((f) => ACCEPTED_IMAGE_TYPES.includes(f.type)),
      "characters.form.error.onlyImages",
    )
    .refine(
      (files) =>
        files &&
        Array.from(files).reduce((acc, f) => acc + f.size, 0) <= MAX_TOTAL_SIZE,
      "characters.form.error.maxSize",
    ),
});

type FormValues = z.infer<typeof formSchema>;

function CreateNewCharacterDialog({
  isOpen,
  onClose,
  onCreate,
  isCreating,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, files: File[]) => void;
  isCreating: boolean;
}) {
  const { t } = useTranslation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", files: undefined },
  });

  const fileRef = form.register("files");
  const files = form.watch("files");
  const selectedFiles = files ? Array.from(files) : [];

  const onSubmit = (data: FormValues) => {
    onCreate(data.name, Array.from(data.files));
  };

  const handleClose = () => {
    if (isCreating) return;
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("characters.dialog.createTitle")}</DialogTitle>
          <DialogDescription>
            {t("characters.dialog.createDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Side: Form */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("characters.form.name")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={isCreating}
                          placeholder={t("characters.form.namePlaceholder")}
                        />
                      </FormControl>
                      <FormMessage>
                        {form.formState.errors.name &&
                          t(form.formState.errors.name.message as any)}
                      </FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="files"
                  render={() => (
                    <FormItem>
                      <FormLabel>{t("characters.form.images")}</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          multiple
                          accept={ACCEPTED_IMAGE_TYPES.join(",")}
                          {...fileRef}
                          disabled={isCreating}
                          className="mt-1"
                        />
                      </FormControl>
                      <FormDescription>
                        {t("characters.form.imagesHint")}
                      </FormDescription>
                      <FormMessage>
                        {form.formState.errors.files &&
                          t(form.formState.errors.files.message as any, {
                            min: 10,
                            max: 20,
                            size: "50MB",
                          })}
                      </FormMessage>
                    </FormItem>
                  )}
                />

                {selectedFiles.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="relative aspect-square">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`preview ${index}`}
                          className="h-full w-full object-cover rounded-md"
                        />
                        {index === 0 && (
                          <div className="absolute bottom-0 w-full bg-black/50 text-white text-xs text-center rounded-b-md py-0.5">
                            {t("characters.form.cover")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Side: Guide */}
              <div className="bg-muted/50 p-6 rounded-lg">
                <h4 className="font-semibold mb-3 text-card-foreground">
                  {t("characters.guide.title")}
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>{t("characters.guide.rule1", { min: 10, max: 20 })}</li>
                  <li>
                    {t("characters.guide.rule2")}
                    <ul className="list-disc pl-4 mt-1 space-y-1">
                      <li>{t("characters.guide.rule2_1")}</li>
                      <li>{t("characters.guide.rule2_2")}</li>
                      <li>{t("characters.guide.rule2_3")}</li>
                    </ul>
                  </li>
                  <li>{t("characters.guide.rule3")}</li>
                  <li>{t("characters.guide.rule4")}</li>
                  <li>{t("characters.guide.rule5")}</li>
                  <li>{t("characters.guide.rule6")}</li>
                  <li>{t("characters.guide.rule7", { size: "50MB" })}</li>
                </ul>
              </div>
            </div>

            <Button type="submit" disabled={isCreating} className="w-full">
              {isCreating ? (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("characters.buttons.createAction")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// =================================================================================
// 4. Character Card & Skeleton Components
// =================================================================================
function CharacterCard({ character }: { character: CharacterForList }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isConfirmingDelete, setConfirmingDelete] = useState(false);
  const deleteTimerRef = useRef<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: useConvexMutation(api.characters.del),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listCharactersQuery.queryKey });
      toast.success(t("characters.toast.deleteSuccess"));
    },
    onError: (error) => {
      toast.error(t("characters.toast.deleteError"), {
        description: error instanceof ConvexError ? error.data : error.message,
      });
    },
  });

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        window.clearTimeout(deleteTimerRef.current);
      }
    };
  }, []);

  const handleDeleteClick = () => {
    if (isConfirmingDelete) {
      if (deleteTimerRef.current) {
        window.clearTimeout(deleteTimerRef.current);
        deleteTimerRef.current = null;
      }
      deleteMutation.mutate({ characterId: character._id });
    } else {
      setConfirmingDelete(true);
      deleteTimerRef.current = window.setTimeout(() => {
        setConfirmingDelete(false);
        deleteTimerRef.current = null;
      }, 3000); // Revert after 3 seconds
    }
  };

  const getStatusVariant = (status: CharacterForList["status"]) => {
    switch (status) {
      case "pending":
        return "secondary";
      case "training":
        return "default";
      case "ready":
        return "success";
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusText = (status: CharacterForList["status"]) => {
    switch (status) {
      case "pending":
        return t("characters.status.pending");
      case "training":
        return t("characters.status.training");
      case "ready":
        return t("characters.status.ready");
      case "failed":
        return t("characters.status.failed");
      default:
        return status;
    }
  };

  return (
    <Card>
      <CardHeader className="p-0">
        <div className="aspect-square w-full relative">
          {character.coverImageUrl ? (
            <img
              src={character.coverImageUrl}
              alt={character.name}
              className="h-full w-full object-cover rounded-t-lg"
            />
          ) : (
            <div className="h-full w-full bg-secondary flex items-center justify-center rounded-t-lg">
              <LucideImage className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <CardTitle className="text-lg font-semibold truncate">
                {character.name}
              </CardTitle>
            </TooltipTrigger>
            <TooltipContent>
              <p>{character.name}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardContent>
      <CardFooter className="flex justify-between items-center p-4 pt-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant={getStatusVariant(character.status)}>
                {character.status === "training" && (
                  <Loader className="mr-2 h-3 w-3 animate-spin" />
                )}
                {getStatusText(character.status)}
              </Badge>
            </TooltipTrigger>
            {character.status === "failed" && character.failureReason && (
              <TooltipContent>
                <p>{character.failureReason}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu
          onOpenChange={(open) => {
            // Reset confirmation state when menu is closed
            if (!open) setConfirmingDelete(false);
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={deleteMutation.isPending}
            >
              <Ellipsis className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()} // Prevents menu from closing on click
              onClick={handleDeleteClick}
              disabled={
                character.status === "training" || deleteMutation.isPending
              }
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              {deleteMutation.isPending ? (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash className="mr-2 h-4 w-4" />
              )}
              <span>
                {isConfirmingDelete
                  ? t("characters.buttons.deleteConfirm")
                  : t("characters.buttons.delete")}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
}

function CharacterCardSkeleton() {
  return (
    <Card>
      <CardHeader className="p-0">
        <Skeleton className="aspect-square w-full rounded-b-none" />
      </CardHeader>
      <CardContent className="p-4">
        <Skeleton className="h-6 w-3/4" />
      </CardContent>
      <CardFooter className="flex justify-between p-4 pt-0">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </CardFooter>
    </Card>
  );
}
