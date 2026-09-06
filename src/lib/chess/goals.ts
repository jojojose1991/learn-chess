import { Chess } from "chess.js"

import type { PlayedMove } from "./rules"

/**
 * What a Student must bring about. A kind and a number, evaluated against the
 * board (ADR-0001) — no solution moves exist to compare against.
 */
export type Goal = { kind: "mate_in"; n: number }

export type GoalOutcome =
  | { status: "open" }
  | { status: "solved" }
  | { status: "failed"; reason: string }

export const moveWord = (n: number) => (n === 1 ? "move" : "moves")

const failed = (reason: string): GoalOutcome => ({ status: "failed", reason })

/**
 * The Goal said out loud, for a Library row and for Play's line above the
 * board. Plain words rather than "mate in 2": the reader on Play is five.
 */
// ponytail: assumes `mate_in`, as `evaluateGoal` does — a second Goal kind
// has to branch in both.
export const describeGoal = (goal: Goal) =>
  `Checkmate in ${goal.n} ${moveWord(goal.n)}`

/**
 * Whether the Goal is still open, solved, or out of reach, given the Position
 * the Puzzle starts from and the moves played from it in order.
 *
 * The start is a parameter because a Position can be over before anyone has
 * touched it: nothing stops a Coach saving one that is already checkmate,
 * stalemate or drawn.
 *
 * The Student moves first, so the odd-numbered plies are theirs and the
 * opponent's replies never count against the budget.
 */
export function evaluateGoal(
  goal: Goal,
  start: string,
  moves: Array<PlayedMove>
): GoalOutcome {
  const board = new Chess(moves.at(-1)?.fen ?? start, { skipValidation: true })
  const studentMoved = moves.length % 2 === 1
  const spent = Math.ceil(moves.length / 2)

  if (board.isCheckmate()) {
    if (!studentMoved) return failed("Your own king has been checkmated.")
    return spent <= goal.n
      ? { status: "solved" }
      : failed(
          `That is checkmate, but it took more than ${goal.n} ${moveWord(goal.n)}.`
        )
  }

  // "The player to move", not "the other side": the stalemated player is the
  // Student whenever the stalemate was stored or arrived on the reply.
  if (board.isStalemate()) {
    return failed(
      "That is stalemate: the player to move has no legal move, but is not in check. The game is a draw."
    )
  }

  if (board.isInsufficientMaterial()) {
    return failed(
      "Neither side has enough pieces left to give checkmate. The game is a draw."
    )
  }

  // The last way a board can be over. It has to be here rather than only in
  // `chess.js`: `engineThinking` asks the board whether a move is left, and a
  // draw this knew nothing about would leave an attempt with no outcome, an
  // unlocked board and nobody to move on it. Threefold is the one draw still
  // missing, and cannot be: it is path-dependent and a Puzzle starts from a
  // FEN with no history behind it.
  if (board.isDrawByFiftyMoves()) {
    return failed(
      "Fifty moves have passed with no capture and no pawn moved. The game is a draw."
    )
  }

  if (spent >= goal.n) {
    return failed(
      `That is ${spent} ${moveWord(spent)} played, and no checkmate.`
    )
  }

  return { status: "open" }
}

/**
 * How deep the search will look. Beyond this the answer is "we do not know",
 * never "there is no mate" — see `hasNoMateWithin`.
 *
 * Two, because the search is full width and Save is a request a Coach waits
 * on. Searching only checking moves would go deeper cheaply and is wrong: a
 * mate whose first move is quiet — take the opposition, step a rook onto the
 * file — is the commonest shape a Coach sets, and pruning to checks called 12
 * of 334 random mates-in-2 unsolvable. The measured cost of full width on a
 * busy Position with no mate in it is ~230ms at n=2 and ~5.9s at n=3, so this
 * is where the line falls today.
 *
 * "Mate in 2" is docs/PLAN.md's own example, so the Goals this actually checks
 * are the ones most Puzzles use; deeper ones are taken on the Coach's word.
 *
 * Raising this is not just a cost decision. `mateWithin` threads one board
 * down the search, so `isGameOver()` there sees move history — and threefold
 * repetition, unlike the draws guarded below, is path-dependent and cannot be
 * read off a FEN. It needs eight plies to arise and this searches at most
 * four, so it cannot bite at two; a ceiling of four or more has to handle it.
 */
const SEARCH_CEILING = 2

/**
 * Whether this Position is known to have no mate within `n` of the side to
 * move's own moves — which is the only answer a caller can act on. A Goal is
 * still a predicate and no line is stored (ADR-0001); this only proves whether
 * one exists, so an unsolvable Puzzle is refused at Save rather than found by
 * a Student on a board that has stopped taking taps.
 *
 * False, not true, past `SEARCH_CEILING`: a Goal too deep to search is taken
 * on the Coach's word rather than called unsolvable on a search that never
 * ran, because refusing a correct Puzzle is the worse of the two failures.
 */
export function hasNoMateWithin(fen: string, n: number): boolean {
  if (n > SEARCH_CEILING) return false
  return !mateWithin(new Chess(fen, { skipValidation: true }), n)
}

/**
 * Forced, not merely available: the attacker needs one move that works against
 * *every* reply, which is what alternates `some` and `every` here.
 */
function mateWithin(board: Chess, n: number): boolean {
  if (n <= 0 || board.isGameOver()) return false

  return board.moves().some((move) => {
    board.move(move)
    try {
      if (board.isCheckmate()) return true
      // A reply that draws is a refutation, not a step on the way.
      if (board.isStalemate() || board.isInsufficientMaterial()) return false
      return board.moves().every((reply) => {
        board.move(reply)
        try {
          return mateWithin(board, n - 1)
        } finally {
          board.undo()
        }
      })
    } finally {
      board.undo()
    }
  })
}
