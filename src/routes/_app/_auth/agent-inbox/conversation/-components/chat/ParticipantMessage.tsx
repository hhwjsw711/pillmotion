import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip";
import { useTimeAgo } from "@/hooks/useTimeAgo";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Doc } from "convex/_generated/dataModel";
import { api } from "~/convex/_generated/api";
import { AgentMention } from "./AgentMention";
import { UserMention } from "./UserMention";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { splitMessageContent } from "~/shared/mentions";
import { ReplyIcon } from "lucide-react";
import { createMentionString } from "~/shared/mentions";
import { useChatContext } from "./ChatContext";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";

interface Props {
  message: Doc<"conversationMessages">;
}

export const ParticipantMessage: React.FC<Props> = ({ message }) => {
  if (message.kind != "participant")
    throw new Error("Message is not a participant message");

  const { setReplyToMention, setShouldFocusInput } = useChatContext();
  const [isHovered, setIsHovered] = React.useState(false);

  const { data: participants, isLoading: isLoadingParticipants } = useQuery(
    convexQuery(api.conversationParticipants.queries.listDetailsForMe, {
      conversationId: message.conversationId,
    }),
  );

  const { data: agents, isLoading: isLoadingAgents } = useQuery(
    convexQuery(api.agents.queries.listMine, {}),
  );

  const participant = participants?.find(
    (p) => p.id === message.authorParticipantId,
  );

  // Get all agents to find the matching one for this participant
  const matchingAgent =
    participant?.kind === "agent" &&
    agents?.find((agent) => agent.name === participant.name);

  const timeAgo = useTimeAgo(message._creationTime);

  if (isLoadingParticipants || isLoadingAgents) {
    return (
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex flex-col gap-2 py-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  const handleReply = () => {
    if (participant?.kind === "agent" && matchingAgent) {
      const mentionText = createMentionString({
        kind: "agent",
        agentId: matchingAgent._id,
        name: participant.name ?? "Agent",
      });
      setReplyToMention(mentionText + " ");
      setShouldFocusInput(true);
    }
  };

  const renderMessageContent = (content: string) => {
    const parts = splitMessageContent(content);

    return parts.map((part, index) => {
      if (part.type === "text") {
        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            components={{
              // Ensure links open in new tab
              a: (props) => (
                <a
                  {...props}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${
                    participant?.kind === "user"
                      ? "text-primary-foreground  decoration-primary-foreground/70 hover:decoration-primary-foreground hover:text-orange-200"
                      : "text-blue-600 dark:text-blue-400 font-medium  decoration-blue-600/70 dark:decoration-blue-400/70 hover:text-orange-500 dark:hover:text-orange-400"
                  } transition-all`}
                />
              ),
              // Preserve the styling of your messages
              p: (props) => <span {...props} />,
            }}
          >
            {part.content}
          </ReactMarkdown>
        );
      } else {
        const reference = part.reference;
        if (reference.kind === "agent") {
          return (
            <AgentMention
              key={`mention-${index}`}
              display={reference.display}
              agentId={reference.agentId}
              isInUserMessage={participant?.kind === "user"}
            />
          );
        } else {
          return (
            <UserMention
              key={`mention-${index}`}
              display={reference.display}
              userId={reference.userId}
              isInUserMessage={participant?.kind === "user"}
            />
          );
        }
      }
    });
  };

  return (
    <div
      className={`flex items-start gap-3 ${
        participant?.kind === "user" ? "flex-row-reverse" : "flex-row"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className="mt-1">
              <AvatarImage src={participant?.avatarUrl} />
              <AvatarFallback>
                {participant?.kind === "user"
                  ? "U"
                  : (participant?.name?.[0] ?? "A")}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            {participant?.kind === "user"
              ? "You"
              : (participant?.name ?? "Agent")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div className="relative max-w-[70%]">
        <div
          className={`rounded-lg p-3 ${
            participant?.kind === "user"
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          }`}
        >
          {participant?.kind === "agent" && (
            <div className="text-sm font-medium text-foreground mb-1">
              {participant.name}
            </div>
          )}
          <div className="space-x-1">
            {renderMessageContent(message.content)}
          </div>
          <div
            className={`text-xs mt-1 ${
              participant?.kind === "user"
                ? "text-primary-foreground/80"
                : "text-muted-foreground"
            }`}
          >
            {timeAgo}
          </div>
        </div>

        {participant?.kind === "agent" && matchingAgent && isHovered && (
          <Button
            onClick={handleReply}
            variant="ghost"
            size="icon"
            className="absolute -right-10 top-1/2 -translate-y-1/2 hover:bg-accent rounded-full"
            aria-label="Reply to agent"
          >
            <ReplyIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
