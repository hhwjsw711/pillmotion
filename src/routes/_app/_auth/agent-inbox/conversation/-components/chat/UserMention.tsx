import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { BaseMention } from "./BaseMention";
import { Ghost } from "lucide-react";

interface UserMentionProps {
  display: string;
  userId: Id<"users">;
  isInUserMessage?: boolean;
}

export const UserMention: React.FC<UserMentionProps> = ({
  display,
  userId,
  isInUserMessage,
}) => {
  const { data: user } = useQuery(
    convexQuery(api.users.queries.findMention, { userId }),
  );

  return (
    <BaseMention
      display={user?.name ?? display}
      isInUserMessage={isInUserMessage}
      avatar={
        <Avatar className="h-4 w-4 translate-y-[1px]">
          {user?.image ? (
            <AvatarImage src={user.image} />
          ) : (
            <AvatarFallback className="bg-muted">
              <Ghost className="h-3 w-3" />
            </AvatarFallback>
          )}
        </Avatar>
      }
    />
  );
};
