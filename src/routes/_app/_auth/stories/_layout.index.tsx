import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/_auth/stories/_layout/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_app/_auth/stories/_layout/"!</div>
}
