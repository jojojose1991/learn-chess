import { createFileRoute } from "@tanstack/react-router"
import { DEFAULT_POSITION } from "chess.js"
import { useState } from "react"

import { MoveBoard } from "@/components/move-board"
import { applyMove } from "@/lib/chess/rules"

import type { Square } from "chess.js"

export const Route = createFileRoute("/_coach/puzzles/new")({
  component: NewPuzzle,
})

function NewPuzzle() {
  // ponytail: a hardcoded Position, and a Guidance toggle that belongs beside
  // Reset and Hint on Play. Both are here because the board needs somewhere to
  // be until 08 gives the editor a Position of its own and 09 builds Play.
  const [fen, setFen] = useState(DEFAULT_POSITION)
  const [lastMove, setLastMove] = useState<{
    from: Square
    to: Square
  } | null>(null)
  const [guidance, setGuidance] = useState(true)
  // The guard already read the session; the theme rides along with the Coach.
  const { coach } = Route.useRouteContext()

  return (
    // Padding is `p-4` before `sm`: at 390px, `p-6` leaves each square 42.75px,
    // under the 44px a five-year-old's finger needs (docs/PLAN.md).
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl">New Puzzle</h1>

      {/* The label is the tap target, so the 44px floor does not depend on how
          big a checkbox happens to be. */}
      <label className="flex min-h-11 w-fit items-center gap-3 rounded-lg border px-3 text-sm">
        <input
          type="checkbox"
          checked={guidance}
          onChange={(event) => setGuidance(event.target.checked)}
          className="size-5 accent-brand-ink"
        />
        Guidance
      </label>

      {/* The cap keeps the board on a short screen; the board itself only
          knows how to be square. */}
      <div className="max-w-[80vh]">
        <MoveBoard
          fen={fen}
          guidance={guidance}
          theme={coach.boardTheme}
          lastMove={lastMove}
          onMove={(from, to, promotion) => {
            const played = applyMove(fen, from, to, promotion)
            // ponytail: an illegal attempt is dropped in silence until 09 puts
            // `explainIllegal`'s sentence on screen beside the board.
            if (!played.ok) return
            setFen(played.fen)
            setLastMove({ from, to })
          }}
        />
      </div>
    </main>
  )
}
