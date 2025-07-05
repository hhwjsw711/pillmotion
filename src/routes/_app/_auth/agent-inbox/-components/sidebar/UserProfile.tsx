import { Card } from "@/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar";
import { SignOutButton } from "./SignOutButton";
import { User } from "~/types";

export function UserProfile({ user }: { user: User }) {
  if (!user) {
    return null;
  }

  return (
    <Card className="m-2 p-2">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage src={user?.avatarUrl} />
          <AvatarFallback>{user?.name?.[0] ?? "U"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-card-foreground truncate">
            {user?.username}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {user?.email}
          </div>
        </div>
        <SignOutButton />
      </div>
    </Card>
  );
}
