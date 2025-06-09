import { createFileRoute } from "@tanstack/react-router";
import ChatWindow from "./-components/chat-window";

export const Route = createFileRoute("/_app/_auth/generate/_layout/")({
  component: Generate,
});

export default function Generate() {
  return (
    <div className="flex flex-1 flex-col overflow-y-hidden">
      <ChatWindow />
    </div>
  );
}
