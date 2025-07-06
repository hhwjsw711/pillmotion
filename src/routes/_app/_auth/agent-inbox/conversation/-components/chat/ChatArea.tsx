import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ConversationHeader } from "./ConversationHeader";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { Skeleton } from "@/ui/skeleton";
import { ChatProvider } from "./ChatContext";

interface ChatAreaProps {
  conversationId: Id<"conversations">;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ conversationId }) => {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const { data: conversation, isLoading: isConversationLoading } = useQuery(
    convexQuery(api.conversations.queries.findMine, {
      conversationId,
    }),
  );

  const { data: messages, isLoading: isMessagesLoading } = useQuery(
    convexQuery(api.conversationMessages.queries.listForMe, {
      conversationId,
    }),
  );

  const isLoading = isConversationLoading || isMessagesLoading;

  const scrollToBottom = React.useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  React.useEffect(() => {
    if (messages && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages?.length, scrollToBottom]);

  return (
    <ChatProvider>
      <div className="flex flex-col h-screen bg-background">
        <ConversationHeader conversation={conversation} />
        <div className="relative flex-1">
          <div className="absolute inset-0 flex flex-col-reverse">
            <div className="absolute bottom-0 left-0 right-0">
              <ChatInput conversationId={conversationId} />
            </div>
            <div className="overflow-y-auto pb-24">
              <div className="p-4 space-y-4">
                {isLoading ? (
                  <>
                    <div className="flex justify-start">
                      <Skeleton className="h-24 w-2/3" />
                    </div>
                    <div className="flex justify-end">
                      <Skeleton className="h-16 w-1/2" />
                    </div>
                    <div className="flex justify-start">
                      <Skeleton className="h-20 w-3/5" />
                    </div>
                  </>
                ) : (
                  <>
                    {messages
                      ?.filter(Boolean)
                      .map((message) => (
                        <ChatMessage key={message._id} message={message} />
                      ))}
                    <ThinkingIndicator conversationId={conversationId} />
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ChatProvider>
  );
};
