import { describe, expect, it } from "vitest"

import { playReducer, startPlay } from "@/lib/chess/play"

import type { Square } from "chess.js"
import type { PlayAction, PlayState } from "@/lib/chess/play"
import type { PromotionPiece } from "@/lib/chess/rules"

/** White plays Qg7 mate; Black is not already in check, so it is legal too. */
const MATE_IN_ONE = "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1"

/** A white pawn one square from the last rank, and a king each so it is legal. */
const PROMOTING = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1"

/**
 * Black to move, one move into the Fool's Mate: ...e5, g4, Qh4#. Both sides
 * are moved by the person at the board, and only Black's two count.
 */
const FOOLS = "rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1"

const opened = (fen: string, n = 1) =>
  startPlay({ fen, goal: { kind: "mate_in", n } })

/** The Puzzle after those attempts, in order — the reducer folded over play. */
function run(state: PlayState, ...actions: Array<PlayAction>): PlayState {
  return actions.reduce(playReducer, state)
}

const move = (
  from: Square,
  to: Square,
  promotion?: PromotionPiece
): PlayAction => ({ type: "move", from, to, promotion })

const sans = (state: PlayState) => state.moves.map((played) => played.san)

describe("starting a Puzzle", () => {
  it("opens at the Position the Puzzle was stored with, nothing played", () => {
    const state = opened(MATE_IN_ONE, 2)

    expect(state.fen).toBe(MATE_IN_ONE)
    expect(state.moves).toEqual([])
    expect(state.status).toEqual({ status: "open" })
    expect(state.refusal).toBeNull()
  })
})

describe("playing a move", () => {
  it("plays a legal move and writes it into the move list in notation", () => {
    const state = run(opened(MATE_IN_ONE), move("g1", "g7"))

    expect(sans(state)).toEqual(["Qg7#"])
    expect(state.fen).toBe("7k/6Q1/5K2/8/8/8/8/8 b - - 1 1")
  })

  it("refuses an illegal move in words a Student can read, and moves nothing", () => {
    const state = run(opened(MATE_IN_ONE), move("f6", "h6"))

    expect(state.refusal).toBe(
      "A king moves one square at a time, in any direction."
    )
    expect(state.fen).toBe(MATE_IN_ONE)
    expect(state.moves).toEqual([])
  })

  it("forgets the refusal once a legal move lands, because it was feedback and not history", () => {
    const state = run(opened(MATE_IN_ONE), move("f6", "h6"), move("g1", "g7"))

    expect(state.refusal).toBeNull()
  })

  it("accepts a legal but losing move with no warning of any kind", () => {
    // Qg8+ hangs the queen to the king it checks: the worst move on the
    // board, and nothing interrupts it. Only the Goal has anything to say.
    const state = run(opened(MATE_IN_ONE), move("g1", "g8"))

    expect(sans(state)).toEqual(["Qg8+"])
    expect(state.refusal).toBeNull()
    expect(state.status).toEqual({
      status: "failed",
      reason: "That is 1 move played, and no checkmate.",
    })
  })

  it("promotes to the piece the Student chose, and the move list says which", () => {
    const state = run(opened(PROMOTING), move("a7", "a8", "r"))

    expect(sans(state)).toEqual(["a8=R+"])
  })

  it("keeps the squares a move was played between, so the board can mark it", () => {
    const state = run(opened(MATE_IN_ONE), move("g1", "g7"))

    expect(state.moves.at(-1)).toMatchObject({ from: "g1", to: "g7" })
  })

  it("counts only the Student's own moves against the budget, however the mate is reached", () => {
    const state = run(
      opened(FOOLS, 2),
      move("e7", "e5"),
      move("g2", "g4"),
      move("d8", "h4")
    )

    expect(sans(state)).toEqual(["e5", "g4", "Qh4#"])
    expect(state.status).toEqual({ status: "solved" })
  })
})

describe("Rewind and Reset", () => {
  it("takes back the last move played, because in local play every move is the Student's", () => {
    const state = run(opened(FOOLS, 2), move("e7", "e5"), move("g2", "g4"), {
      type: "rewind",
    })

    expect(sans(state)).toEqual(["e5"])
    expect(state.fen).toBe(
      "rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2"
    )
  })

  it("rewinds a Puzzle with nothing played to itself, rather than past its start", () => {
    const state = run(opened(MATE_IN_ONE), { type: "rewind" })

    expect(state.fen).toBe(MATE_IN_ONE)
    expect(state.moves).toEqual([])
  })

  it("reopens a Goal the move that ran the budget out had closed", () => {
    const spent = run(opened(FOOLS, 1), move("e7", "e5"))
    expect(spent.status).toEqual({
      status: "failed",
      reason: "That is 1 move played, and no checkmate.",
    })

    expect(playReducer(spent, { type: "rewind" }).status).toEqual({
      status: "open",
    })
  })

  it("returns to the stored Position with an empty move list on Reset", () => {
    const state = run(opened(FOOLS, 2), move("e7", "e5"), move("g2", "g4"), {
      type: "reset",
    })

    expect(state.fen).toBe(FOOLS)
    expect(state.moves).toEqual([])
    expect(state.status).toEqual({ status: "open" })
  })

  it("clears a refusal, so a reason does not outlive the Position it was about", () => {
    for (const action of [
      { type: "rewind" },
      { type: "reset" },
    ] as Array<PlayAction>) {
      const refused = run(opened(MATE_IN_ONE), move("f6", "h6"))

      expect(playReducer(refused, action).refusal).toBeNull()
    }
  })
})
