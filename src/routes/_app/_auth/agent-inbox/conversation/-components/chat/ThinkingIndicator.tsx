import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Avatar, AvatarImage, AvatarFallback } from "@/ui/avatar";
import { Loader2 } from "lucide-react";

interface ThinkingIndicatorProps {
  conversationId: Id<"conversations">;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  conversationId,
}) => {
  const { data: thinkingParticipants } = useQuery({
    ...convexQuery(
      api.conversationParticipants.queries.listThinkingParticipants,
      {
        conversationId,
      },
    ),
    refetchInterval: 2000, // Refetch every 2 seconds
  });

  if (!thinkingParticipants?.length) return null;

  return (
    <>
      {thinkingParticipants.map((participant) => (
        <div key={participant.id} className="flex items-start gap-3">
          <Avatar className="mt-1">
            <AvatarImage src={participant.avatarUrl} />
            <AvatarFallback>{participant.name[0]}</AvatarFallback>
          </Avatar>
          <div className="max-w-[70%] rounded-lg p-3 bg-muted">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{participant.name} is thinking</span>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};
