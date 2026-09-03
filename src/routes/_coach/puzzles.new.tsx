import { createFileRoute } from "@tanstack/react-router"
import { DEFAULT_POSITION } from "chess.js"

import { Board } from "@/components/board"

export const Route = createFileRoute("/_coach/puzzles/new")({
  component: NewPuzzle,
})

function NewPuzzle() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="font-heading text-2xl font-medium">New Puzzle</h1>

      {/* ponytail: a hardcoded Position and a tap that goes nowhere until 08
          gives the editor a Position of its own. The cap keeps the board on
          a short screen; the board itself only knows how to be square. */}
      <div className="max-w-[80vh]">
        <Board fen={DEFAULT_POSITION} onSquareTap={() => {}} />
      </div>
    </main>
  )
}
