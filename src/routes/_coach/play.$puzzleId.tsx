import { createFileRoute, notFound } from "@tanstack/react-router"

import { PlayPuzzle } from "@/components/play-puzzle"
import { fetchPuzzle } from "@/lib/puzzles"

export const Route = createFileRoute("/_coach/play/$puzzleId")({
  loader: async ({ params }) => {
    const puzzle = await fetchPuzzle({ data: params.puzzleId })
    // Another Coach's Puzzle is not found rather than refused, so an unlisted
    // URL does not confirm what it guards.
    if (!puzzle) throw notFound()
    return puzzle
  },
  component: Play,
})

/** Screen 5, local versus local. A Puzzle Link lands on the same board (11). */
function Play() {
  const puzzle = Route.useLoaderData()
  const { coach } = Route.useRouteContext()

  return (
    // Wider than the other screens, because this is the one with a move list
    // beside the board. `p-4` before `sm`: at 390px, `p-6` leaves each square
    // 42.75px, under the 44px a five-year-old's finger needs (docs/PLAN.md).
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl">{puzzle.name}</h1>

      <PlayPuzzle
        // Keyed by id so opening another Puzzle starts from its own Position
        // rather than the line still in the reducer.
        key={puzzle.id}
        puzzle={puzzle}
        theme={coach.boardTheme}
      />
    </main>
  )
}
