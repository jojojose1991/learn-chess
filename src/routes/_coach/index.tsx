import { createFileRoute, useRouter } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/_coach/")({ component: Library })

function Library() {
  const { coach } = Route.useRouteContext()
  const navigate = Route.useNavigate()
  const router = useRouter()

  async function signOut() {
    await authClient.signOut()
    // Drop the guard's answer, so going back cannot reach this page again.
    await router.invalidate()
    await navigate({ to: "/sign-in" })
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="font-heading text-2xl font-medium">Library</h1>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </header>
      <p className="text-sm text-muted-foreground">
        Signed in as {coach.email}. No puzzles yet.
      </p>
    </main>
  )
}
