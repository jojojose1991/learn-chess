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
 * Whether the Goal is still open, solved, or out of reach, given the moves
 * played from the Puzzle's Position in order.
 *
 * The Student moves first, so the odd-numbered plies are theirs and the
 * opponent's replies never count against the budget.
 */
export function evaluateGoal(
  goal: Goal,
  moves: Array<PlayedMove>
): GoalOutcome {
  if (moves.length === 0) return { status: "open" }

  const board = new Chess(moves[moves.length - 1].fen, { skipValidation: true })
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

  if (board.isStalemate()) {
    return failed(
      "That is stalemate: the other side has no legal move, but is not in check. The game is a draw."
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
