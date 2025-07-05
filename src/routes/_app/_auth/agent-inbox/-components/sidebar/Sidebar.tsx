import { Link } from "@tanstack/react-router";
// import { ConversationList } from "./ConversationList";
import { AgentList } from "./AgentList";
import { buttonVariants } from "@/ui/button-util";
import { cn } from "@/utils/misc";
import { UserProfile } from "./UserProfile";
import { User } from "~/types";

type Tab = "conversations" | "agents";

export const Sidebar = ({
  user,
  activeTab,
}: {
  user: User;
  activeTab: Tab;
}) => {
  return (
    <div className="flex flex-col h-full border-r">
      <div className="h-24 border-b border-border relative overflow-hidden">
        <img
          src="/images/logo.png"
          alt="Agent Inbox"
          className="absolute -right-0 -top-2 h-32 object-cover dark:hidden"
        />
        <img
          src="/images/logo-white.png"
          alt="Agent Inbox"
          className="absolute -right-0 -top-2 h-32 object-cover hidden dark:block"
        />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
      </div>
      <div className="flex border-b">
        <Link
          search={{ tab: "conversations" }}
          className={cn(
            buttonVariants({
              variant: activeTab === "conversations" ? "default" : "ghost",
            }),
            "flex-1 rounded-none",
          )}
        >
          Conversations
        </Link>
        <Link
          search={{ tab: "agents" }}
          className={cn(
            buttonVariants({
              variant: activeTab === "agents" ? "default" : "ghost",
            }),
            "flex-1 rounded-none",
          )}
        >
          Agents
        </Link>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {/* {activeTab === "conversations" ? <ConversationList /> : <AgentList />} */}
          <AgentList />
        </div>
      </div>
      <UserProfile user={user} />
    </div>
  );
};
