import { Chess, SQUARES, validateFen } from "chess.js"

import type { Color, Piece, PieceSymbol, Square } from "chess.js"

type SquareContent = { square: Square; piece: Piece | null }

/**
 * Every square of a Position, a8 to h1 — the order the board renders in.
 * Skips validation so Confirm & Edit can draw an invalid Position while
 * refusing to play it.
 */
export function readPlacement(fen: string): Array<SquareContent> {
  return new Chess(fen, { skipValidation: true })
    .board()
    .flat()
    .map((piece, index) => ({ square: SQUARES[index], piece }))
}

/** A board with nothing on it, White to move: where Confirm & Edit begins. */
export const EMPTY_POSITION = "8/8/8/8/8/8/8/8 w - - 0 1"

/**
 * The Position with `piece` standing on `square`, or with that square cleared
 * when it is null. Whatever stood there is replaced, and a king moves rather
 * than being duplicated — `chess.js` refuses a second one of a colour, which
 * would leave a Coach who put it down wrong with a tap that did nothing.
 *
 * Skips validation, because a Position under construction is illegal for most
 * of the time it takes to build one.
 */
export function withPiece(
  fen: string,
  square: Square,
  piece: Piece | null
): string {
  const board = new Chess(fen, { skipValidation: true })
  if (!piece) {
    board.remove(square)
  } else {
    if (piece.type === "k") {
      // Never the square it is going back on: `remove` clears that side's
      // castling rights and `put` does not give them back, so a king dropped
      // where it already stood would strip them with nothing else changed.
      for (const held of board.findPiece({ type: "k", color: piece.color })) {
        if (held !== square) board.remove(held)
      }
    }
    board.put(piece, square)
  }
  return board.fen()
}

/**
 * The Position with `color` to move. Any en-passant capture goes with the
 * turn — it was offered to the other side — and the clocks go back to the
 * start, because a hand-built Position has no moves behind it.
 *
 * Field surgery rather than `setTurn`, which advances the halfmove clock on
 * every flip, so a Coach toggling twice would not land back where they were.
 */
export function withSideToMove(fen: string, color: Color): string {
  const [placement, , castling] = fen.split(" ")
  return `${placement} ${color} ${castling} - 0 1`
}

/** A Position is legal, or it is not, with reasons a person can read. */
export type PositionValidity =
  { ok: true } | { ok: false; reasons: Array<string> }

/** What a promoting pawn may become. A king is not a choice; a pawn is not one either. */
export type PromotionPiece = "n" | "b" | "r" | "q"

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
 * The piece a tap on `square` may pick up: the one standing there if it is the
 * side to move's. An empty square and the waiting side's pieces are nobody's
 * to move, which is what makes a tap on either do nothing.
 */
export function pieceToMove(fen: string, square: Square): Piece | null {
  const position = new Chess(fen, { skipValidation: true })
  const piece = position.get(square)
  return piece && piece.color === position.turn() ? piece : null
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
  promotion?: PromotionPiece
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

/**
 * Whether that move lands a pawn on the last rank, and so has to be asked
 * about before it can be played at all — `chess.js` refuses a promotion with
 * no piece named. False for a move that is illegal anyway, so no picker opens
 * on one.
 */
export function isPromotion(fen: string, from: Square, to: Square): boolean {
  return new Chess(fen)
    .moves({ square: from, verbose: true })
    .some((move) => move.to === to && move.promotion !== undefined)
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
