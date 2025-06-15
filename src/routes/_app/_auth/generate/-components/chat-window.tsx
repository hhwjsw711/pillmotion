import { useQuery, useMutation } from "convex/react";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { useWindowSize } from "@/utils/misc";
import MessageItem from "./message-item";
import { ServerMessage } from "./server-message";
import { api } from "@cvx/_generated/api";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip";
import { Send, Trash2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ChatWindow() {
  const { t } = useTranslation();
  const [drivenIds, setDrivenIds] = useState<Set<string>>(new Set());
  const [isStreaming, setIsStreaming] = useState(false);
  const messages = useQuery(api.messages.listMessages);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const clearAllMessages = useMutation(api.messages.clearMessages);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior });
      }
    },
    [messagesEndRef],
  );

  const windowSize = useWindowSize();

  useEffect(() => {
    scrollToBottom();
  }, [windowSize, scrollToBottom]);

  const sendMessage = useMutation(api.messages.sendMessage);

  if (!messages) return null;

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <div
        ref={messageContainerRef}
        className="flex-1 overflow-y-auto py-6 px-4 md:px-6"
      >
        <div className="w-full max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground pt-16">
              {t("chatEmptyState")}
            </div>
          )}
          {messages.map((message) => (
            <React.Fragment key={message._id}>
              <MessageItem message={message} isUser={true}>
                {message.prompt}
              </MessageItem>
              <MessageItem message={message} isUser={false}>
                <ServerMessage
                  message={message}
                  isDriven={drivenIds.has(message._id)}
                  stopStreaming={() => {
                    setIsStreaming(false);
                    focusInput();
                  }}
                  scrollToBottom={scrollToBottom}
                />
              </MessageItem>
            </React.Fragment>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-border bg-background/90 backdrop-blur-sm sticky bottom-0">
        <TooltipProvider>
          <div className="w-full max-w-4xl mx-auto p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!inputValue.trim()) return;

                const originalValue = inputValue;
                setInputValue("");

                const chatId = await sendMessage({
                  prompt: originalValue,
                });

                setDrivenIds((prev) => {
                  const newSet = new Set(prev);
                  newSet.add(chatId);
                  return newSet;
                });

                setIsStreaming(true);
              }}
              className="w-full space-y-2"
            >
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={t("chatPlaceholder")}
                  disabled={isStreaming}
                  className="flex-1 text-base"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="submit"
                      disabled={!inputValue.trim() || isStreaming}
                      size="icon"
                    >
                      {isStreaming ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span className="sr-only">{t("chatSend")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {isStreaming
                        ? t("chatTooltipSending")
                        : t("chatTooltipSend")}
                    </p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      disabled={messages.length === 0 || isStreaming}
                      onClick={() => {
                        clearAllMessages();
                        setInputValue("");
                        setIsStreaming(false);
                        focusInput();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">{t("chatTooltipClear")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("chatTooltipClearDescription")}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </form>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
