import { createFileRoute, notFound, useRouter } from "@tanstack/react-router"

import { PuzzleEditor } from "@/components/puzzle-editor"
import { PuzzleShare } from "@/components/puzzle-share"
import {
  fetchPuzzleLink,
  mintPuzzleLink,
  revokePuzzleLink,
} from "@/lib/puzzle-links"
import { fetchPuzzle, savePuzzle } from "@/lib/puzzles"

export const Route = createFileRoute("/_coach/puzzles/$puzzleId")({
  loader: async ({ params }) => {
    // Two round trips, concurrently: neither waits on the other, and the
    // screen draws once both have answered rather than with a share block
    // still deciding what it is.
    const [puzzle, link] = await Promise.all([
      fetchPuzzle({ data: params.puzzleId }),
      fetchPuzzleLink({ data: params.puzzleId }),
    ])
    // Another Coach's Puzzle is not found rather than refused, so an unlisted
    // URL does not confirm what it guards.
    if (!puzzle) throw notFound()
    return { puzzle, link }
  },
  component: EditPuzzle,
})

/** Confirm & Edit again, on a Puzzle that is already in the Library. */
function EditPuzzle() {
  const { puzzle, link } = Route.useLoaderData()
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
        onSave={async (draft, next) => {
          const written = await savePuzzle({
            data: { ...draft, id: puzzle.id },
          })
          if ("error" in written) return written
          await router.invalidate()
          await navigate(
            next === "play"
              ? { to: "/play/$puzzleId", params: { puzzleId: written.id } }
              : { to: "/" }
          )
          return {}
        }}
      />

      {/* Outside the editor's `<form>`, because a form inside a form is not
          one — and a link shares the Puzzle that is stored, never the edits
          the screen is still holding. */}
      <PuzzleShare
        url={link?.url}
        // Both re-read the loader rather than reporting on themselves, so the
        // link on screen is the one the database has.
        onMint={async () => {
          await mintPuzzleLink({ data: puzzle.id })
          await router.invalidate()
        }}
        onRevoke={async () => {
          await revokePuzzleLink({ data: puzzle.id })
          await router.invalidate()
        }}
      />
    </main>
  )
}
