import { Chess, validateFen } from "chess.js"

import type { Color, Square } from "chess.js"

/** A Position is legal, or it is not, with reasons a person can read. */
export type PositionValidity =
  { ok: true } | { ok: false; reasons: Array<string> }

export type MoveOutcome =
  { ok: true; fen: string; san: string } | { ok: false; reason: string }

/** What `chess.js` reports, said the way we say it. */
const structuralReasons: Record<string, string> = {
  "missing white king": "White has no king.",
  "missing black king": "Black has no king.",
  "too many white kings": "White has more than one king.",
  "too many black kings": "Black has more than one king.",
  "some pawns are on the edge rows":
    "A pawn cannot stand on the first or the last rank.",
}

const sideName: Record<Color, string> = { w: "White", b: "Black" }

/**
 * Whether a Position may be played. `chess.js` catches the malformed and the
 * king counts; the pawn ceiling and a waiting side already in check are ours.
 */
export function validatePosition(fen: string): PositionValidity {
  const structure = validateFen(fen)
  if (!structure.ok) {
    // The one reason and no more: a Position this malformed cannot be
    // reasoned about further, so the pawn and check tests below would be
    // guessing at a board that does not exist.
    const detail = structure.error?.replace("Invalid FEN: ", "") ?? ""
    return {
      ok: false,
      reasons: [structuralReasons[detail] ?? "That is not a legal position."],
    }
  }

  const position = new Chess(fen, { skipValidation: true })
  const reasons: Array<string> = []

  for (const color of ["w", "b"] as const) {
    if (position.findPiece({ type: "p", color }).length > 8) {
      reasons.push(`${sideName[color]} has more than eight pawns.`)
    }
  }

  const turn = position.turn()
  const waiting: Color = turn === "w" ? "b" : "w"
  // Exactly one king a side is already guaranteed by the check above.
  const [king] = position.findPiece({ type: "k", color: waiting })
  if (position.isAttacked(king, turn)) {
    reasons.push(
      `${sideName[waiting]} is in check, but it is ${sideName[turn]}'s turn to move.`
    )
  }

  return reasons.length > 0 ? { ok: false, reasons } : { ok: true }
}

/**
 * The squares the piece on `square` may move to — empty when the square is
 * empty, holds the waiting side's piece, or is off the board. Drives Guidance.
 *
 * Takes a Position that has already passed `validatePosition`; anything else
 * throws, because that is a bug in the caller and not a move a person made.
 */
export function legalTargets(fen: string, square: Square): Array<Square> {
  const moves = new Chess(fen).moves({ square, verbose: true })
  // A promotion is four moves to one square; a tap only cares about the square.
  return [...new Set(moves.map((move) => move.to))]
}

/**
 * The Position that results from a move, or why it cannot be played. Like
 * `legalTargets`, it expects an already-validated Position.
 */
export function applyMove(
  fen: string,
  from: Square,
  to: Square,
  promotion?: "n" | "b" | "r" | "q"
): MoveOutcome {
  const position = new Chess(fen)
  try {
    const move = position.move({ from, to, promotion })
    return { ok: true, fen: position.fen(), san: move.san }
  } catch {
    return {
      ok: false,
      reason: `${from} to ${to} is not a legal move in this position.`,
    }
  }
}
