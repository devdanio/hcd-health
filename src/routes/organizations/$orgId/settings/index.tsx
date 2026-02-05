import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/organizations/$orgId/settings/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/organizations/$orgId/settings/org",
      params,
    })
  },
  component: () => null,
})
