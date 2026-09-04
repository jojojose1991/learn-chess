import { useState } from "react"

import { Board, pieceName, pieceSrc } from "@/components/board"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  EMPTY_POSITION,
  validatePosition,
  withPiece,
  withSideToMove,
} from "@/lib/chess/rules"
import { log } from "@/lib/log"
import { GOAL_N_MAX, GOAL_N_MIN, NAME_MAX } from "@/lib/puzzles/rules"
import { cn } from "@/lib/utils"

import type { Color, Piece, PieceSymbol } from "chess.js"
import type { BoardOrientation } from "@/components/board"
import type { PuzzleDraft } from "@/lib/puzzles/rules"

type PuzzleEditorProps = {
  /** A Puzzle being reopened. Absent means a new one, from an empty board. */
  puzzle?: PuzzleDraft
  /** Writes it, or says why it could not be written. */
  onSave: (draft: PuzzleDraft) => Promise<{ error?: string }>
}

/**
 * The twelve pieces and the eraser, as one list — so every tap on the board
 * means exactly what the tray says, and none of it depends on what is already
 * standing on the square. The entries are the identities `holding` compares
 * against, which is why they are made once here and not per render.
 */
const TRAY: Array<Piece | null> = [
  ...(["w", "b"] as const).flatMap((color) =>
    (["k", "q", "r", "b", "n", "p"] as Array<PieceSymbol>).map((type) => ({
      type,
      color,
    }))
  ),
  null,
]

/**
 * Confirm & Edit: the by-hand setup tool, and the screen a Scan will later be
 * confirmed on. A Coach places pieces, says whose turn it is and how many
 * moves the mate is in — never a move, because a Goal is a predicate and not a
 * solution line (ADR-0001).
 *
 * It wraps the plain `Board`, not `MoveBoard`: here two taps are two
 * placements rather than one move.
 */
export function PuzzleEditor({ puzzle, onSave }: PuzzleEditorProps) {
  const [fen, setFen] = useState(puzzle?.fen ?? EMPTY_POSITION)
  const [name, setName] = useState(puzzle?.name ?? "")
  const [goalN, setGoalN] = useState(String(puzzle?.goal.n ?? GOAL_N_MIN))
  const [holding, setHolding] = useState<Piece | null>(TRAY[0])
  const [orientation, setOrientation] = useState<BoardOrientation>("white")
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const validity = validatePosition(fen)
  const sideToMove = fen.split(" ")[1] as Color

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      const refusal = await onSave({
        name,
        fen,
        goal: { kind: "mate_in", n: Number(goalN) },
      })
      setError(refusal.error)
    } catch (failure) {
      // A write that never got an answer at all. Without this the Coach is
      // left with a Save that stays disabled and a Position only they have.
      log.error(() => `saving a Puzzle failed: ${String(failure)}`)
      setError("That did not save. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      {/* The cap keeps the board on a short screen; the board itself only
          knows how to be square. */}
      <div className="max-w-[80vh]">
        <Board
          fen={fen}
          orientation={orientation}
          onSquareTap={(square) => setFen(withPiece(fen, square, holding))}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-sm text-muted-foreground">
          Piece to place
        </legend>
        <div className="flex flex-wrap gap-1">
          {TRAY.map((piece) => (
            <label
              key={pieceName(piece)}
              className={cn(
                "relative flex size-11 items-center justify-center rounded-lg border-2 bg-muted",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                piece === holding ? "border-board-mark" : "border-transparent"
              )}
            >
              {/* The whole swatch is the control, rather than a screen-reader
                  input beside it: the tap target is then the 44px a finger
                  needs and not whatever a radio happens to be. */}
              <input
                type="radio"
                name="tray"
                className="absolute inset-0 cursor-pointer appearance-none rounded-lg"
                checked={piece === holding}
                onChange={() => setHolding(piece)}
              />
              {piece ? (
                <img
                  src={pieceSrc(piece.color, piece.type)}
                  alt=""
                  draggable={false}
                  className="h-full w-full"
                />
              ) : (
                <span aria-hidden className="text-xs">
                  Empty
                </span>
              )}
              <span className="sr-only">{pieceName(piece)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-sm text-muted-foreground">
            Side to move
          </legend>
          <div className="flex gap-2">
            {(["w", "b"] as const).map((color) => (
              <label
                key={color}
                className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
              >
                <input
                  type="radio"
                  name="side-to-move"
                  className="size-4 accent-brand-ink"
                  checked={sideToMove === color}
                  onChange={() => setFen(withSideToMove(fen, color))}
                />
                {color === "w" ? "White" : "Black"}
              </label>
            ))}
          </div>
        </fieldset>

        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() =>
            setOrientation(orientation === "white" ? "black" : "white")
          }
        >
          Flip board
        </Button>
      </div>

      {validity.ok ? null : (
        // Not a live region: it is read while placing pieces, and announcing
        // every reason on every tap would talk over the Coach doing it.
        <div className="flex flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">This position cannot be played yet.</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {validity.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-40 flex-1 flex-col gap-2">
          <Label htmlFor="puzzle-name">Name</Label>
          <Input
            id="puzzle-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={NAME_MAX}
            required
            className="min-h-11"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="goal-n">Mate in</Label>
          <div className="flex items-center gap-2">
            <Input
              id="goal-n"
              type="number"
              inputMode="numeric"
              value={goalN}
              onChange={(event) => setGoalN(event.target.value)}
              min={GOAL_N_MIN}
              max={GOAL_N_MAX}
              step={1}
              required
              className="min-h-11 w-20"
            />
            <span className="text-sm text-muted-foreground">moves</span>
          </div>
        </div>
        <Button
          type="submit"
          className="min-h-11"
          disabled={!validity.ok || busy}
        >
          Save
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
