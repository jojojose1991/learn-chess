import { useReducer, useState } from "react"

import { MoveBoard } from "@/components/move-board"
import { Button } from "@/components/ui/button"
import { describeGoal } from "@/lib/chess/goals"
import { playReducer, startPlay } from "@/lib/chess/play"

import type { BoardTheme } from "@/db/schema"
import type { PuzzleDraft } from "@/lib/puzzles/rules"

type PlayPuzzleProps = {
  puzzle: PuzzleDraft
  /** The board this Coach teaches on, straight through to the board. */
  theme?: BoardTheme
}

const whiteToMove = (fen: string) => fen.split(" ")[1] === "w"

/**
 * Play, local versus local: both sides are moved by the person at the board.
 * The loop is `playReducer` and lives nowhere else here — this screen dispatches
 * taps into it and draws what comes back.
 *
 * Guidance is the one thing it holds itself. It changes no rule, no history and
 * no Goal, so it is a view preference rather than part of the game's state.
 */
export function PlayPuzzle({ puzzle, theme }: PlayPuzzleProps) {
  const [game, dispatch] = useReducer(playReducer, puzzle, startPlay)
  const [guidance, setGuidance] = useState(true)

  return (
    // 900px is `docs/PLAN.md`'s own number for where the list moves beside the
    // board; below it the list is a strip underneath.
    <div className="flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-start">
      <div className="flex w-full max-w-[80vh] flex-col gap-3 min-[900px]:max-w-[min(80vh,32rem)] min-[900px]:shrink-0">
        <p className="text-sm text-muted-foreground">
          {describeGoal(game.goal)}
        </p>

        <MoveBoard
          fen={game.fen}
          guidance={guidance}
          // Whose Puzzle it is to solve, decided once by the Position it was
          // stored with. A board that turned round every ply is unusable.
          orientation={whiteToMove(game.start) ? "white" : "black"}
          theme={theme}
          lastMove={game.moves.at(-1)}
          onMove={(from, to, promotion) =>
            dispatch({ type: "move", from, to, promotion })
          }
        />

        <p aria-live="polite">
          {whiteToMove(game.fen) ? "White" : "Black"} to move
        </p>

        {game.refusal ? (
          <p role="alert" className="text-sm text-destructive">
            {game.refusal}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => dispatch({ type: "rewind" })}
          >
            Rewind
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => dispatch({ type: "reset" })}
          >
            Reset
          </Button>
          {/* The whole label is the target, so a five-year-old's finger has
              the 44px it needs rather than whatever a checkbox happens to be. */}
          <label className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring">
            <input
              type="checkbox"
              className="size-4 accent-brand-ink"
              checked={guidance}
              onChange={(event) => setGuidance(event.target.checked)}
            />
            Guidance
          </label>
        </div>
      </div>

      {/* `role` explicitly: Tailwind's preflight sets `list-style: none`, and
          WebKit drops the implicit list role from a list styled that way. */}
      <ol
        role="list"
        aria-label="Moves"
        className="flex min-w-0 flex-1 gap-x-4 gap-y-1 overflow-x-auto rounded-lg border p-3 text-sm min-[900px]:flex-col"
      >
        {game.moves.map((move, ply) => (
          <li key={ply} className="whitespace-nowrap">
            {move.san}
          </li>
        ))}
      </ol>
    </div>
  )
}
