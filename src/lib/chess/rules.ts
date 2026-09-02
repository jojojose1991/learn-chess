import { Chess, validateFen } from "chess.js"

import type { Color, Piece, PieceSymbol, Square } from "chess.js"

/** A Position is legal, or it is not, with reasons a person can read. */
export type PositionValidity =
  { ok: true } | { ok: false; reasons: Array<string> }

/** A move that was played: exactly what a successful `applyMove` returns. */
export type PlayedMove = { fen: string; san: string }

export type MoveOutcome =
  ({ ok: true } & PlayedMove) | { ok: false; reason: string }

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
  // A promotion is four moves to one square; a tap only cares about the square.
  return [...new Set(targetsOf(new Chess(fen), square))]
}

/** Where the piece on `square` may go, as squares rather than moves. */
function targetsOf(board: Chess, square: Square): Array<Square> {
  return board.moves({ square, verbose: true }).map((move) => move.to)
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

/** How each piece moves, for a Student who has just tried something else. */
const movementReasons: Record<PieceSymbol, string> = {
  p: "A pawn moves straight forward, and only takes a piece diagonally.",
  n: "A knight moves in an L: two squares one way, then one square across.",
  b: "A bishop moves only along the slanted lines, never straight.",
  r: "A rook moves only in straight lines, up and down or side to side.",
  q: "A queen moves in straight lines in any direction, but never in an L.",
  k: "A king moves one square at a time, in any direction.",
}

/**
 * The squares the piece could reach if its own king's safety did not matter.
 * Taking the king off the board is what turns `chess.js`'s legal move
 * generation into pseudo-legal generation — the check filter has nothing left
 * to filter on. Meaningless for a king move, which is why nothing asks.
 */
function pseudoLegalTargets(fen: string, from: Square): Array<Square> {
  const board = new Chess(fen, { skipValidation: true })
  const [king] = board.findPiece({ type: "k", color: board.turn() })
  board.remove(king)
  return targetsOf(board, from)
}

/** The same piece alone on an empty board: its movement shape and nothing else. */
function shapeTargets(piece: Piece, from: Square): Array<Square> {
  const board = new Chess(undefined, { skipValidation: true })
  board.clear()
  board.put(piece, from)
  board.setTurn(piece.color)
  return targetsOf(board, from)
}

/**
 * Why a move a Student just tried cannot be played, in one sentence with no
 * notation and no jargon. Expects a move `applyMove` has already rejected;
 * a legal move has no explanation to give.
 */
export function explainIllegal(fen: string, from: Square, to: Square): string {
  const position = new Chess(fen)
  const piece = position.get(from)

  if (!piece) return "There is no piece on that square."
  if (piece.color !== position.turn()) return "That is not your piece."
  if (position.get(to)?.color === piece.color) {
    return "One of your own pieces is already on that square."
  }

  // A castle is the one move whose shape says nothing about why it failed:
  // no rights, or a square attacked on the way, all look alike. Only from the
  // king's own square, though — anywhere else, two squares sideways is just
  // two squares sideways.
  const fileDistance = Math.abs(from.charCodeAt(0) - to.charCodeAt(0))
  const homeSquare = piece.color === "w" ? "e1" : "e8"
  if (piece.type === "k" && from === homeSquare && fileDistance === 2) {
    return "Your king cannot castle right now."
  }

  // Order matters: a pinned pawn's capture is a real pawn capture, so it has
  // to be recognised on the true board before the empty-board shape — where
  // there is nothing to capture — gets to call it bad pawn geometry.
  const shape = shapeTargets(piece, from)
  const reachable = piece.type === "k" ? shape : pseudoLegalTargets(fen, from)
  if (reachable.includes(to)) return "That would leave your king in danger."
  if (shape.includes(to)) {
    // A pawn's shape is its own file, so an occupied square it can reach is
    // always a piece standing in front of it rather than one in its path.
    return piece.type === "p" && position.get(to)
      ? "A pawn cannot take a piece straight ahead — only diagonally."
      : "There is a piece in the way."
  }
  return movementReasons[piece.type]
}
