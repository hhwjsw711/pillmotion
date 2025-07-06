import { createFileRoute } from "@tanstack/react-router";
import { Id } from "~/convex/_generated/dataModel";
import { ChatArea } from "./-components/chat/ChatArea";

export const Route = createFileRoute(
  "/_app/_auth/agent-inbox/conversation/$conversationId",
)({
  component: ConversationPage,
  parseParams: (params) => ({
    conversationId: params.conversationId as Id<"conversations">,
  }),
  stringifyParams: (params) => ({ conversationId: params.conversationId }),
});

function ConversationPage() {
  const { conversationId } = Route.useParams();
  return <ChatArea conversationId={conversationId} />;
}
