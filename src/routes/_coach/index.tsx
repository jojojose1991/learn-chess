import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router"

import { Button, buttonVariants } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { fetchLibrary } from "@/lib/puzzles"

export const Route = createFileRoute("/_coach/")({
  loader: async () => {
    const puzzles = await fetchLibrary()
    // The session went between the guard and here.
    if (!puzzles) throw redirect({ to: "/sign-in" })
    return puzzles
  },
  component: Library,
})

function Library() {
  const puzzles = Route.useLoaderData()
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
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-heading text-2xl font-medium">Library</h1>
        <div className="flex items-baseline gap-4">
          <Link to="/puzzles/new" className={buttonVariants()}>
            New Puzzle
          </Link>
          {coach.isAdmin ? (
            <Link to="/admin" className="text-sm underline underline-offset-4">
              Accounts
            </Link>
          ) : null}
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>

      {puzzles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No puzzles yet. Set one up and it will be here.
        </p>
      ) : (
        // `role` explicitly: Tailwind's preflight sets `list-style: none`, and
        // WebKit drops the implicit list role from a list styled that way.
        <ul role="list" aria-label="Puzzles" className="flex flex-col">
          {puzzles.map((puzzle) => (
            <li key={puzzle.id} className="border-b py-3">
              {puzzle.name}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">
        Signed in as {coach.email}
      </p>
    </main>
  )
}
