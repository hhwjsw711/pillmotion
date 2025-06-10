import { getConvexSiteUrl } from "@/utils/misc";
import { StreamId } from "@convex-dev/persistent-text-streaming";
import { useStream } from "@convex-dev/persistent-text-streaming/react";
import { api } from "@cvx/_generated/api";
import { Doc } from "@cvx/_generated/dataModel";
import { useMemo, useEffect } from "react";
import Markdown from "react-markdown";
import { useAuthToken } from "@convex-dev/auth/react";
import { MessageActions } from "./message-actions";

export function ServerMessage({
  message,
  isDriven,
  stopStreaming,
  scrollToBottom,
}: {
  message: Doc<"userMessages">;
  isDriven: boolean;
  stopStreaming: () => void;
  scrollToBottom: () => void;
}) {
  const token = useAuthToken();

  const { text, status } = useStream(
    api.streaming.getStreamBody,
    new URL(`${getConvexSiteUrl()}/chat-stream`),
    isDriven,
    message.responseStreamId as StreamId,
    { authToken: token },
  );

  const isCurrentlyStreaming = useMemo(() => {
    if (!isDriven) return false;
    return status === "pending" || status === "streaming";
  }, [isDriven, status]);

  useEffect(() => {
    if (!isDriven) return;
    if (isCurrentlyStreaming) return;
    stopStreaming();
  }, [isDriven, isCurrentlyStreaming, stopStreaming]);

  useEffect(() => {
    if (!text) return;
    scrollToBottom();
  }, [text, scrollToBottom]);

  const isLoading = status === "pending" || status === "streaming";

  return (
    <div>
    <div className="md-answer flex flex-col items-start">
      <Markdown>{text || "Thinking..."}</Markdown>
      {status === "error" && (
        <div className="text-red-500 mt-2">Error loading response</div>
      )}
      </div>
      <MessageActions text={text} isLoading={isLoading} />
    </div>
  );
}
