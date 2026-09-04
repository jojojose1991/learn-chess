import { createFileRoute, useRouter } from "@tanstack/react-router"

import { PuzzleEditor } from "@/components/puzzle-editor"
import { savePuzzle } from "@/lib/puzzles"

export const Route = createFileRoute("/_coach/puzzles/new")({
  component: NewPuzzle,
})

/**
 * Confirm & Edit on an empty board. There is one way in today, so this is not
 * a screen offering a choice between it and a Scan — ticket 14 adds the
 * second way, and the choice with it.
 */
function NewPuzzle() {
  const router = useRouter()
  const navigate = Route.useNavigate()

  return (
    // Padding is `p-4` before `sm`: at 390px, `p-6` leaves each square 42.75px,
    // under the 44px a five-year-old's finger needs (docs/PLAN.md).
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl">New Puzzle</h1>

      <PuzzleEditor
        onSave={async (draft) => {
          const written = await savePuzzle({ data: draft })
          if ("error" in written) return written
          // The Library is where a saved Puzzle now is, so that is where the
          // Coach goes to see that it arrived.
          await router.invalidate()
          await navigate({ to: "/" })
          return {}
        }}
      />
    </main>
  )
}
