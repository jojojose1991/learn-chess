import { Link, createFileRoute, redirect } from "@tanstack/react-router"

import { CheckerMark } from "@/components/checker-mark"
import { describeGoal } from "@/lib/chess/goals"
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

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl">Library</h1>

      {puzzles.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <CheckerMark className="size-12 text-brand/25" />
          <p className="text-sm text-muted-foreground">
            No puzzles yet. Set one up and it will be here.
          </p>
        </div>
      ) : (
        // `role` explicitly: Tailwind's preflight sets `list-style: none`, and
        // WebKit drops the implicit list role from a list styled that way.
        <ul role="list" aria-label="Puzzles" className="flex flex-col divide-y">
          {puzzles.map((puzzle) => (
            <li key={puzzle.id}>
              {/* The row opens Confirm & Edit, which is where a Puzzle is
                  read as much as changed. Play joins it there in 09. */}
              <Link
                to="/puzzles/$puzzleId"
                params={{ puzzleId: puzzle.id }}
                className="group flex min-h-11 flex-col justify-center py-3 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {/* Only the name underlines: the Goal is what the row is,
                    not a second thing to open. */}
                <span className="group-hover:underline">{puzzle.name}</span>
                <span className="text-sm text-muted-foreground">
                  {describeGoal(puzzle.goal)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
