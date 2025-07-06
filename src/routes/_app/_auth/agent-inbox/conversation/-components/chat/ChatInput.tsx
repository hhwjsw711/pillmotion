import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { MentionsInput, Mention, SuggestionDataItem } from "react-mentions";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { AgentAvatar } from "@/ui/agent-avatar";
import { useApiErrorHandler } from "@/hooks/useApiErrorHandler";
import { useChatContext } from "./ChatContext";
import { Button } from "@/ui/button";
import { Send, Loader2 } from "lucide-react";

interface CustomSuggestionData extends SuggestionDataItem {
  type: "agent" | "user";
  avatarUrl?: string;
  display: string;
}

interface ChatInputProps {
  conversationId: Id<"conversations">;
}

export const ChatInput: React.FC<ChatInputProps> = ({ conversationId }) => {
  const [message, setMessage] = React.useState("");
  const queryClient = useQueryClient();
  const onApiError = useApiErrorHandler();

  const agentsQuery = convexQuery(api.agents.queries.listMine, {});
  const { data: agents = [] } = useQuery(agentsQuery);

  const messagesQueryKey = convexQuery(
    api.conversationMessages.queries.listForMe,
    { conversationId },
  ).queryKey;

  const sendMessage = useMutation({
    mutationFn: useConvexMutation(
      api.conversationMessages.mutations.sendFromMe,
    ),
    onSuccess: () => {
      setMessage(""); // Clear input on success
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
    onError: onApiError,
  });

  const {
    replyToMention,
    setReplyToMention,
    shouldFocusInput,
    setShouldFocusInput,
  } = useChatContext();
  const mentionsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (replyToMention) {
      setMessage((prev) => replyToMention + prev);
      setReplyToMention(null);
      mentionsRef.current?.querySelector("textarea")?.focus();
    }
  }, [replyToMention, setReplyToMention]);

  React.useEffect(() => {
    if (shouldFocusInput) {
      mentionsRef.current?.querySelector("textarea")?.focus();
      setShouldFocusInput(false);
    }
  }, [shouldFocusInput, setShouldFocusInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sendMessage.isPending) return;
    sendMessage.mutate({
      content: message,
      conversationId: conversationId,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const suggestions: CustomSuggestionData[] = agents.map((agent) => ({
    id: `agent:${agent._id}`,
    display: agent.name ?? "",
    type: "agent" as const,
    avatarUrl: agent.avatarUrl,
  }));

  return (
    <div className="p-4 sticky bottom-0 z-10">
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 bg-card shadow-lg p-2 rounded-lg border border-border"
      >
        <div className="flex-1 min-w-0" ref={mentionsRef}>
          <MentionsInput
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="mentions"
            placeholder="Type a message... Use @ to mention agents"
            disabled={sendMessage.isPending}
            style={mentionsStyle}
          >
            <Mention
              trigger="@"
              data={suggestions}
              displayTransform={(_id, display) => `@${display}`}
              markup="@[__display__](__id__)"
              appendSpaceOnAdd={true}
              style={{
                backgroundColor: "var(--accent)",
                borderRadius: "6px",
              }}
              renderSuggestion={(suggestion, _search, highlightedDisplay) => {
                const customSuggestion = suggestion as CustomSuggestionData;
                return (
                  <div className="flex items-center gap-2">
                    <AgentAvatar
                      size="sm"
                      avatarUrl={customSuggestion.avatarUrl ?? ""}
                      name={customSuggestion.display}
                    />
                    <span>{highlightedDisplay}</span>
                  </div>
                );
              }}
            />
          </MentionsInput>
        </div>
        <Button
          type="submit"
          disabled={!message.trim() || sendMessage.isPending}
        >
          {sendMessage.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
};

// Extracted styles for better readability
const mentionsStyle = {
  control: {
    backgroundColor: "transparent",
    fontSize: 16,
    fontWeight: "normal",
  },
  input: {
    margin: 0,
    padding: "8px 12px",
    overflow: "auto",
    minHeight: "40px",
    maxHeight: "120px",
    border: "none",
    borderRadius: 6,
    backgroundColor: "transparent",
    color: "inherit",
    outline: "none",
  },
  suggestions: {
    list: {
      backgroundColor: "var(--background)",
      border: "1px solid var(--border)",
      borderRadius: "0.375rem",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
      fontSize: "14px",
      maxHeight: "300px",
      overflow: "auto",
      width: "300px",
      minWidth: "100%",
      position: "absolute" as const,
      bottom: "100%",
      left: 0,
      right: 0,
      marginBottom: "0.5rem",
      zIndex: 1000,
    },
    item: {
      padding: "8px 12px",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      cursor: "pointer",
      transition: "background-color 0.2s",
      whiteSpace: "nowrap",
      overflow: "hidden",
      "&focused": {
        backgroundColor: "var(--accent)",
      },
    },
  },
};
