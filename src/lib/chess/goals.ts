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

const moveWord = (n: number) => (n === 1 ? "move" : "moves")

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

  if (spent >= goal.n) {
    return failed(
      `That is ${spent} ${moveWord(spent)} played, and no checkmate.`
    )
  }

  return { status: "open" }
}
