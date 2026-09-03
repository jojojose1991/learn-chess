import { readPlacement } from "@/lib/chess/rules"
import { cn } from "@/lib/utils"

import type { Piece, PieceSymbol, Square } from "chess.js"
// Type-only, so the schema module — and drizzle with it — is erased rather
// than bundled. The Coach's stored theme and this prop are one type on
// purpose: they cannot drift.
import type { BoardTheme } from "@/db/schema"

export type BoardOrientation = "white" | "black"

type BoardProps = {
  /** The Position to draw. Legal or not — Confirm & Edit draws an invalid one. */
  fen: string
  /** Whose side is nearest the Student. */
  orientation?: BoardOrientation
  theme?: BoardTheme
  /** The only thing the board says. It has no opinion on what a tap means. */
  onSquareTap: (square: Square) => void
}

const PIECE_NAME: Record<PieceSymbol, string> = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
}

/**
 * Hidden from a screen reader: the square's own name already says it. Dark on
 * every square rather than each square's opposite colour, which measured
 * 2.75:1 on green and 2.29:1 on brown against AA's 4.5 — this clears it on all
 * four (5.1:1 the worst of them) and drops a conditional.
 */
const COORDINATE =
  "pointer-events-none absolute px-0.5 text-[0.625rem] text-neutral-900"

/**
 * The board, and nothing else: it draws a Position and emits the square that
 * was tapped. It knows nothing of Goals, engines or games, which is what makes
 * it the same component on the editor and on Play.
 *
 * Square by square, each one a button named for its coordinate and what stands
 * on it — the a11y baseline, and the reason nothing here needs a test id.
 */
export function Board({
  fen,
  orientation = "white",
  theme = "green",
  onSquareTap,
}: BoardProps) {
  const squares = readPlacement(fen)
  // One reversal drives the pieces and the coordinates alike; each label reads
  // the square it is drawn on, so there is no second flip to keep in step.
  const rendered = orientation === "white" ? squares : [...squares].reverse()

  return (
    <div
      // `aspect-square` gives the grid a height from its width, and eight
      // `1fr` tracks each way make every square square with no per-cell rule.
      className={cn(
        "grid aspect-square w-full grid-cols-8 grid-rows-8 select-none",
        `board-${theme}`
      )}
      role="group"
      aria-label="Chess board"
    >
      {rendered.map(({ square, piece }, index) => (
        <button
          key={square}
          type="button"
          onClick={() => onSquareTap(square)}
          aria-label={`${square}, ${describe(piece)}`}
          className={cn(
            "relative",
            isLight(square) ? "bg-board-light" : "bg-board-dark"
          )}
        >
          {piece && (
            <img
              // The artwork is Cburnett's, vendored under BSD-3 (ADR-0004).
              src={`/pieces/${piece.color}${piece.type.toUpperCase()}.svg`}
              alt=""
              className="absolute inset-0 h-full w-full"
            />
          )}
          {/* Ranks down the first column, files along the last row — a
              corner square carries both, in opposite corners. */}
          {index % 8 === 0 && (
            <span aria-hidden className={cn(COORDINATE, "top-0 left-0")}>
              {square[1]}
            </span>
          )}
          {index >= 56 && (
            <span aria-hidden className={cn(COORDINATE, "right-0 bottom-0")}>
              {square[0]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/** Which squares are light, from the coordinate alone: a1 is dark. */
function isLight(square: Square) {
  return (square.charCodeAt(0) + Number(square[1])) % 2 === 1
}

function describe(piece: Piece | null) {
  if (!piece) return "empty"
  return `${piece.color === "w" ? "white" : "black"} ${PIECE_NAME[piece.type]}`
}
