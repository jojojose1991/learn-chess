import { useEffect, useRef, useState } from "react"

import { Board, pieceSrc } from "@/components/board"
import {
  isPromotion,
  legalTargets,
  pieceToMove,
  validatePosition,
} from "@/lib/chess/rules"
import { cn } from "@/lib/utils"

import type { Color, Square } from "chess.js"
import type { BoardTheme } from "@/db/schema"
import type { PromotionPiece } from "@/lib/chess/rules"

type MoveBoardProps = {
  /** The Position being played. Already validated, like `legalTargets`. */
  fen: string
  /** On, a picked-up piece marks where it may go. Off, the Student finds out. */
  guidance: boolean
  /** The board this is painted on, straight through to `Board`. */
  theme?: BoardTheme
  /** The move just played, which the owner of the moves knows and this does not. */
  lastMove?: { from: Square; to: Square } | null
  /**
   * The move that was attempted — legal or not. Whoever owns the Position
   * plays it or refuses it with a reason; nothing moves here.
   */
  onMove: (from: Square, to: Square, promotion?: PromotionPiece) => void
}

/** Queen first, and the first is the biggest — it is the one a Student wants. */
const PROMOTIONS: Array<{ piece: PromotionPiece; name: string }> = [
  { piece: "q", name: "Queen" },
  { piece: "r", name: "Rook" },
  { piece: "b", name: "Bishop" },
  { piece: "n", name: "Knight" },
]

/**
 * Tap a piece, tap a square — no dragging anywhere, because a five-year-old on
 * a touchscreen drags badly. It holds the tap in progress and nothing else: no
 * Position, no rules, no history.
 *
 * Separate from `Board` because two taps do not always mean a move: on Confirm
 * & Edit a tap means "put a piece here", so that screen wants the board that
 * only draws and emits taps. One component doing both would need a mode flag
 * to choose between them.
 */
export function MoveBoard({
  fen,
  guidance,
  theme,
  lastMove = null,
  onMove,
}: MoveBoardProps) {
  const [selected, setSelected] = useState<Square | null>(null)
  const [promoting, setPromoting] = useState<{
    from: Square
    to: Square
    color: Color
  } | null>(null)
  const picker = useRef<HTMLDialogElement>(null)

  // A Position that cannot be played cannot be moved on either — and asking
  // `chess.js` for the legal moves of an illegal Position throws.
  const playable = validatePosition(fen).ok

  useEffect(() => {
    // Modally, so the picker takes the focus, keeps it, closes on Escape and
    // hands focus back to the square that opened it. All of that is the
    // element's, not ours.
    if (promoting) picker.current?.showModal()
  }, [promoting])

  function tap(square: Square) {
    if (!playable) return
    // The same square twice puts the piece back down.
    if (square === selected) {
      setSelected(null)
      return
    }
    // Your own piece is always a new selection, never a move onto it — which
    // is why tap-tap cannot express castling as king-takes-rook.
    if (pieceToMove(fen, square)) {
      setSelected(square)
      return
    }
    // An empty square or the waiting side's piece, with nothing picked up yet.
    if (!selected) return

    const from = selected
    const mover = pieceToMove(fen, from)
    setSelected(null)

    if (mover && isPromotion(fen, from, square)) {
      setPromoting({ from, to: square, color: mover.color })
      return
    }
    onMove(from, square)
  }

  function promote(piece: PromotionPiece) {
    if (!promoting) return
    const { from, to } = promoting
    picker.current?.close()
    setPromoting(null)
    onMove(from, to, piece)
  }

  return (
    <>
      <Board
        fen={fen}
        theme={theme}
        selected={selected}
        targets={
          guidance && playable && selected ? legalTargets(fen, selected) : []
        }
        lastMove={lastMove}
        onSquareTap={tap}
      />

      {promoting && (
        <dialog
          ref={picker}
          aria-label="Promote to"
          // Escape leaves the pawn where it stood, which is the only way out
          // of the picker and the browser's own rather than ours.
          onClose={() => setPromoting(null)}
          className="rounded-xl border bg-card p-3 shadow-lg backdrop:bg-background/70"
        >
          <div className="flex items-end gap-2">
            {PROMOTIONS.map(({ piece, name }, index) => (
              <button
                key={piece}
                type="button"
                // The one a Student wants is under the finger and, being
                // first, under the keyboard too.
                autoFocus={index === 0}
                aria-label={name}
                onClick={() => promote(piece)}
                className={cn(
                  "rounded-lg border-2 bg-muted p-1 hover:border-board-mark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  index === 0 ? "size-22" : "size-16"
                )}
              >
                <img
                  src={pieceSrc(promoting.color, piece)}
                  alt=""
                  draggable={false}
                  className="h-full w-full"
                />
              </button>
            ))}
          </div>
        </dialog>
      )}
    </>
  )
}
