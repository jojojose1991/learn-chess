import { Chess } from "chess.js"
import { describe, expect, it } from "vitest"

import { evaluateGoal } from "@/lib/chess/goals"

import type { PlayedMove } from "@/lib/chess/rules"

/** The Student moves first, so odd-numbered plies here are the Student's. */
function play(fen: string, ...sans: Array<string>): Array<PlayedMove> {
  const game = new Chess(fen)
  return sans.map((san) => ({ san: game.move(san).san, fen: game.fen() }))
}

const MATE_IN_1 = { kind: "mate_in", n: 1 } as const
const MATE_IN_2 = { kind: "mate_in", n: 2 } as const

// Two rooks on the back rank: Ra8 and Rb8 are both mate, so one Position has
// two mating lines. Black's king has no escape square behind its own pawns.
const TWO_ROUTES = "6k1/5ppp/8/8/8/8/8/RR4K1 w - - 0 1"

// Black to move, one move into the Fool's Mate: ...e5, g4, Qh4#. Three plies,
// but only two of them are the Student's.
const FOOLS = "rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1"

describe("evaluateGoal", () => {
  it("is open before anything has been played", () => {
    expect(evaluateGoal(MATE_IN_2, [])).toEqual({ status: "open" })
  })

  it("is open while moves remain in the budget", () => {
    expect(evaluateGoal(MATE_IN_2, play(FOOLS, "e5", "g4"))).toEqual({
      status: "open",
    })
  })

  it("accepts two different mating lines from the same Position", () => {
    expect(evaluateGoal(MATE_IN_1, play(TWO_ROUTES, "Ra8#"))).toEqual({
      status: "solved",
    })
    expect(evaluateGoal(MATE_IN_1, play(TWO_ROUTES, "Rb8#"))).toEqual({
      status: "solved",
    })
  })

  it("counts only the Student's own moves against the budget", () => {
    // Three plies played, two of them the Student's, so mate in 2 is solved.
    expect(evaluateGoal(MATE_IN_2, play(FOOLS, "e5", "g4", "Qh4#"))).toEqual({
      status: "solved",
    })
  })

  it("fails a mate that arrives after the budget is spent", () => {
    const outcome = evaluateGoal(MATE_IN_1, play(FOOLS, "e5", "g4", "Qh4#"))
    expect(outcome).toEqual({
      status: "failed",
      reason: "That is checkmate, but it took more than 1 move.",
    })
  })

  it("fails a spent budget with no checkmate", () => {
    expect(evaluateGoal(MATE_IN_1, play(FOOLS, "e5"))).toEqual({
      status: "failed",
      reason: "That is 1 move played, and no checkmate.",
    })
  })

  it("counts what was actually played, not what the budget allowed", () => {
    expect(evaluateGoal(MATE_IN_1, play(FOOLS, "e5", "g4", "d6"))).toEqual({
      status: "failed",
      reason: "That is 2 moves played, and no checkmate.",
    })
  })

  it("fails when the Student is the one checkmated", () => {
    // The Student is White here, and walks into the Fool's Mate themselves.
    const mated = play(
      "rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq e6 0 2",
      "g4",
      "Qh4#"
    )
    expect(evaluateGoal(MATE_IN_2, mated)).toEqual({
      status: "failed",
      reason: "Your own king has been checkmated.",
    })
  })

  it("fails a stalemate, and says so", () => {
    expect(
      evaluateGoal(MATE_IN_2, play("k7/8/8/1Q6/8/8/8/K7 w - - 0 1", "Qb6"))
    ).toEqual({
      status: "failed",
      reason:
        "That is stalemate: the other side has no legal move, but is not in check. The game is a draw.",
    })
  })

  it("fails a draw by insufficient material, and says so", () => {
    expect(
      evaluateGoal(MATE_IN_2, play("7k/8/8/8/8/8/6b1/K6B w - - 0 1", "Bxg2"))
    ).toEqual({
      status: "failed",
      reason:
        "Neither side has enough pieces left to give checkmate. The game is a draw.",
    })
  })
})
