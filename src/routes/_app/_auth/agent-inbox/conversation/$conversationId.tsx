import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/_auth/agent-inbox/conversation/$conversationId')({
  component: () => <div>Hello /_app/_auth/agent-inbox/conversation/$conversationId!</div>
})