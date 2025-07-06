import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Doc } from "~/convex/_generated/dataModel";
import { ParticipantsDialog } from "./ParticipantsDialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/ui/avatar";
import { Skeleton } from "@/ui/skeleton";

interface ConversationParticipantsProps {
  conversation: Doc<"conversations"> | undefined | null;
}

export const ConversationParticipants: React.FC<
  ConversationParticipantsProps
> = ({ conversation }) => {
  const convex = useConvex();
  const conversationId = conversation?._id;

  const { data: avatars, isLoading } = useQuery({
    queryKey: [
      "convex",
      "conversationParticipants/queries:listAvatars",
      { conversationId: conversationId ?? null },
    ],
    queryFn: () => {
      if (!conversationId) return null;
      return convex.query(api.conversationParticipants.queries.listAvatars, {
        conversationId,
      });
    },
    enabled: !!conversationId,
  });

  if (!conversation) return null;

  if (isLoading) {
    return (
      <div className="flex -space-x-2 ml-auto">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  return (
    <ParticipantsDialog
      conversation={conversation}
      trigger={
        <div className="flex -space-x-2 ml-auto cursor-pointer hover:opacity-80 transition-opacity">
          {avatars?.slice(0, 3).map((url, i) => (
            <Avatar key={i} className="ring-2 ring-background w-8 h-8">
              <AvatarImage src={url} />
              <AvatarFallback>?</AvatarFallback>
            </Avatar>
          ))}
          {(avatars?.length ?? 0) > 3 && (
            <div className="w-8 h-8 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-xs font-medium">
              +{avatars!.length - 3}
            </div>
          )}
        </div>
      }
    />
  );
};
