import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/_auth/decorate/image/$imageId')({
  component: () => <div>Hello /_app/_auth/decorate/image/$imageId!</div>
})