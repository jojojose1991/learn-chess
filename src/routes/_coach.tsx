import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"

import { fetchCoach } from "@/lib/session"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

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
  component: CoachLayout,
})

function CoachLayout() {
  const { coach } = Route.useRouteContext()

  return (
    // ponytail: the vendored provider writes a `sidebar_state` cookie nothing
    // reads, so a collapse lasts until reload. Passing `defaultOpen` from a
    // server-side cookie read is the fix, when a Coach asks for it.
    <SidebarProvider>
      <AppSidebar coach={coach} />
      {/* Not `SidebarInset`: it renders a `<main>`, and each screen has one. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <SidebarTrigger className="m-2" />
        <Outlet />
      </div>
    </SidebarProvider>
  )
}
