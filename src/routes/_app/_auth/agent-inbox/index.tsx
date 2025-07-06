import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/_auth/agent-inbox/")({
  component: AgentInbox,
});

export default function AgentInbox() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Welcome to Agent Inbox</h1>
        <p className="text-muted-foreground">
          Select a conversation or agent to get started
        </p>
      </div>
    </div>
  );
}
