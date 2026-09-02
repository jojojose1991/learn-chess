import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"

import { fetchCoach } from "@/lib/session"

/**
 * Everything a Coach must be signed in to see. The guard runs on the server
 * before the page renders, so nothing behind it reaches a browser that has
 * not signed in.
 */
export const Route = createFileRoute("/_coach")({
  beforeLoad: async () => {
    const coach = await fetchCoach()
    if (!coach) throw redirect({ to: "/sign-in" })
    return { coach }
  },
  component: () => <Outlet />,
})
