import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/_auth/stories/$storyId/refine/_layout/')({
  component: () => <div>Hello /_app/_auth/stories/$storyId/refine/_layout/!</div>
})