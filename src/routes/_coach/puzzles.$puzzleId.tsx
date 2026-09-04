import { createFileRoute, notFound, useRouter } from "@tanstack/react-router"

import { PuzzleEditor } from "@/components/puzzle-editor"
import { fetchPuzzle, savePuzzle } from "@/lib/puzzles"

export const Route = createFileRoute("/_coach/puzzles/$puzzleId")({
  loader: async ({ params }) => {
    const puzzle = await fetchPuzzle({ data: params.puzzleId })
    // Another Coach's Puzzle is not found rather than refused, so an unlisted
    // URL does not confirm what it guards.
    if (!puzzle) throw notFound()
    return puzzle
  },
  component: EditPuzzle,
})

/** Confirm & Edit again, on a Puzzle that is already in the Library. */
function EditPuzzle() {
  const puzzle = Route.useLoaderData()
  const router = useRouter()
  const navigate = Route.useNavigate()
  const { coach } = Route.useRouteContext()

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl">Edit Puzzle</h1>

      <PuzzleEditor
        // Keyed by id so reopening a different Puzzle starts from its own
        // Position rather than the one still in the editor's state.
        key={puzzle.id}
        puzzle={puzzle}
        theme={coach.boardTheme}
        onSave={async (draft) => {
          const written = await savePuzzle({
            data: { ...draft, id: puzzle.id },
          })
          if ("error" in written) return written
          await router.invalidate()
          await navigate({ to: "/" })
          return {}
        }}
      />
    </main>
  )
}
