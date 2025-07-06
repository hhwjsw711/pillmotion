import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { AgentAvatar } from "@/ui/agent-avatar";
import { BaseMention } from "./BaseMention";
import { Bot } from "lucide-react";
import { Avatar, AvatarFallback } from "@/ui/avatar";
import { Route as AgentRoute } from "@/routes/_app/_auth/agent-inbox/agent/$agentId";

interface AgentMentionProps {
  display: string;
  agentId: Id<"agents">;
  isInUserMessage?: boolean;
}

export const AgentMention: React.FC<AgentMentionProps> = ({
  display,
  agentId,
  isInUserMessage,
}) => {
  const agentQuery = convexQuery(api.agents.queries.findMention, { agentId });
  const { data: agent } = useQuery(agentQuery);

  const mentionContent = (
    <BaseMention
      display={agent?.name ?? display}
      isInUserMessage={isInUserMessage}
      avatar={
        agent ? (
          <AgentAvatar
            size="xs"
            avatarUrl={agent.avatarUrl}
            name={agent.name ?? display}
            className="translate-y-[1px]"
          />
        ) : (
          <Avatar className="h-4 w-4 translate-y-[1px]">
            <AvatarFallback className="bg-muted">
              <Bot className="h-3 w-3" />
            </AvatarFallback>
          </Avatar>
        )
      }
    />
  );

  if (!agent?._id) {
    return mentionContent; // Return non-interactive mention if agent not found or invalid
  }

  return (
    <Link
      to={AgentRoute.to}
      params={{ agentId: agent._id }}
      search={true} // Preserve context like tab state
      className="hover:underline decoration-primary"
    >
      {mentionContent}
    </Link>
  );
};
