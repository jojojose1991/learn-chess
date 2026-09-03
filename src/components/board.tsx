import { readPlacement } from "@/lib/chess/rules"
import { cn } from "@/lib/utils"

import type { Color, Piece, PieceSymbol, Square } from "chess.js"
// Type-only, so the schema module — and drizzle with it — is erased rather
// than bundled. The Coach's stored theme and this prop are one type on
// purpose: they cannot drift.
import type { BoardTheme } from "@/db/schema"

export type BoardOrientation = "white" | "black"

/** What a square has to say. One colour, three shapes; nothing else is marked. */
type Mark = "selected" | "target" | "last"

type BoardProps = {
  /** The Position to draw. Legal or not — Confirm & Edit draws an invalid one. */
  fen: string
  /** Whose side is nearest the Student. */
  orientation?: BoardOrientation
  theme?: BoardTheme
  /** The square whose piece has been picked up, if one has. */
  selected?: Square | null
  /** Guidance's marks: where the picked-up piece may go. */
  targets?: ReadonlyArray<Square>
  /** The move just played, marked on both of its squares. */
  lastMove?: { from: Square; to: Square } | null
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

/** What each mark adds to the square's name, for a Student who cannot see it. */
const MARK_NAME: Record<Mark, string> = {
  selected: "selected",
  target: "can move here",
  last: "last move",
}

/**
 * Hidden from a screen reader: the square's own name already says it. Dark on
 * every square rather than each square's opposite colour, which measured
 * 2.75:1 on green and 2.29:1 on brown against AA's 4.5 — this clears it on all
 * four (5.1:1 the worst of them) and drops a conditional.
 */
const COORDINATE =
  "pointer-events-none absolute z-20 px-0.5 text-[0.625rem] text-neutral-900"

/**
 * The board, and nothing else: it draws a Position and emits the square that
 * was tapped. It knows nothing of Goals, engines or games, which is what makes
 * it the same component on the editor and on Play. The marks are told to it;
 * it works out none of them.
 *
 * Square by square, each one a button named for its coordinate, what stands on
 * it and what it is marked as — the a11y baseline, and the reason nothing here
 * needs a test id.
 */
export function Board({
  fen,
  orientation = "white",
  theme = "green",
  selected = null,
  targets = [],
  lastMove = null,
  onSquareTap,
}: BoardProps) {
  const squares = readPlacement(fen)
  // One reversal drives the pieces and the coordinates alike; each label reads
  // the square it is drawn on, so there is no second flip to keep in step.
  const rendered = orientation === "white" ? squares : [...squares].reverse()

  /** One mark to a square, and the live one wins over the one just played. */
  function markOn(square: Square): Mark | null {
    if (square === selected) return "selected"
    if (targets.includes(square)) return "target"
    if (square === lastMove?.from || square === lastMove?.to) return "last"
    return null
  }

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
      {rendered.map(({ square, piece }, index) => {
        const mark = markOn(square)

        return (
          <button
            key={square}
            type="button"
            onClick={() => onSquareTap(square)}
            aria-label={`${square}, ${describe(piece)}${
              mark ? `, ${MARK_NAME[mark]}` : ""
            }`}
            className={cn(
              // Full alpha: the base layer's `outline-ring/50` measures
              // 2.36:1 on the dark green square (docs/adr/0005).
              "relative focus-visible:z-30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
              isLight(square) ? "bg-board-light" : "bg-board-dark"
            )}
          >
            {mark && (
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute",
                  markShape(mark, piece !== null)
                )}
              />
            )}
            {piece && (
              <img
                src={pieceSrc(piece.color, piece.type)}
                alt=""
                // An `<img>` drags natively, ghost and all, with no handler
                // written anywhere. Tap-tap is the only gesture this has.
                draggable={false}
                className="absolute inset-0 z-10 h-full w-full"
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
        )
      })}
    </div>
  )
}

/**
 * One colour, three shapes. A wash sits under the piece so it stays readable;
 * a Guidance mark sits over it, because a capture is marked on the square the
 * piece being taken stands on. Only the shapes carry 3:1 — a wash is 1.9:1 on
 * the dark green square at any alpha that leaves the square its own colour,
 * which is why every mark also says itself in the square's name.
 */
function markShape(mark: Mark, occupied: boolean) {
  if (mark === "selected") {
    return "inset-0 border-4 border-board-mark bg-board-mark/45"
  }
  if (mark === "last") {
    return "inset-0 border-2 border-board-mark bg-board-mark/45"
  }
  return occupied
    ? "inset-[4%] z-20 rounded-full border-4 border-board-mark"
    : "inset-[34%] z-20 rounded-full bg-board-mark"
}

/**
 * Where a piece's artwork lives. Cburnett's, vendored under BSD-3 (ADR-0004)
 * and referenced by URL rather than imported, which is why the path shape
 * belongs in one place.
 */
export function pieceSrc(color: Color, type: PieceSymbol) {
  return `/pieces/${color}${type.toUpperCase()}.svg`
}

/** Which squares are light, from the coordinate alone: a1 is dark. */
function isLight(square: Square) {
  return (square.charCodeAt(0) + Number(square[1])) % 2 === 1
}

function describe(piece: Piece | null) {
  if (!piece) return "empty"
  return `${piece.color === "w" ? "white" : "black"} ${PIECE_NAME[piece.type]}`
}
