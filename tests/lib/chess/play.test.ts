import { describe, expect, it } from "vitest"

import { engineThinking, playReducer, startPlay } from "@/lib/chess/play"

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

/** White to move, with Black's pawn one square from queening on the reply. */
const DEFENDER_PROMOTES = "4k3/8/8/8/8/8/p7/4K2R w K - 0 1"

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

/** The Puzzle after the engine answers, from wherever the Position stands. */
const answered = (
  state: PlayState,
  from: Square,
  to: Square,
  promotion?: PromotionPiece
) =>
  playReducer(state, {
    type: "engine_move",
    fen: state.fen,
    from,
    to,
    promotion,
  })

/** The Puzzle after the engine failed to answer about where it stands. */
const wentQuiet = (state: PlayState) =>
  playReducer(state, { type: "engine_failed", fen: state.fen })

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
})

describe("Rewind and Reset", () => {
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
    const state = run(
      answered(run(opened(FOOLS, 2), move("e7", "e5")), "g2", "g4"),
      { type: "reset" }
    )

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

describe("the end of an attempt", () => {
  it("opens a Puzzle stored in checkmate as an attempt already over, not an open Goal", () => {
    expect(opened("7k/6Q1/5K2/8/8/8/8/8 b - - 1 1", 2).status).toEqual({
      status: "failed",
      reason: "Your own king has been checkmated.",
    })
  })

  it("plays nothing more once the Goal is solved, so a mated board stops explaining taps", () => {
    const solved = run(opened(MATE_IN_ONE), move("g1", "g7"))
    expect(solved.status).toEqual({ status: "solved" })

    const after = run(solved, move("h8", "h7"))

    expect(sans(after)).toEqual(["Qg7#"])
    expect(after.fen).toBe(solved.fen)
    expect(after.refusal).toBeNull()
  })

  // Reverses ticket 10's "a closed attempt takes no more moves", which applied
  // one rule where docs/PLAN.md has two: the engine defends *and then* the
  // budget runs out. A Student who is told "Not this time" and shown nothing
  // is robbed of finding out why it failed, which is the thing PLAN protects.
  it("still lets the defender answer a spent budget, so the Student sees the refutation", () => {
    const spent = run(opened(FOOLS, 1), move("e7", "e5"))
    expect(spent.status.status).toBe("failed")

    const after = answered(spent, "g2", "g4")

    expect(sans(after)).toEqual(["e5", "g4"])
  })

  it("keeps the attempt failed once the defender has answered, so an answer is not a reprieve", () => {
    const spent = run(opened(FOOLS, 1), move("e7", "e5"))

    expect(answered(spent, "g2", "g4").status).toEqual({
      status: "failed",
      reason: "That is 1 move played, and no checkmate.",
    })
  })

  // The gate that lets a lost attempt be answered reads the board, and the
  // Goal reads the board: if the two disagree about what "over" means, a draw
  // one of them has not heard of leaves the board unlocked with no outcome and
  // no way on but Rewind. The 50-move rule is the one `chess.js` counts and
  // `evaluateGoal` did not.
  it("closes an attempt the 50-move rule has drawn, rather than leaving the board open", () => {
    // Halfmove clock at 99: a quiet move makes it 100 and draws the game.
    const drawn = run(
      opened("4k3/8/8/8/8/8/4R3/4K3 w - - 99 60", 3),
      move("e2", "d2")
    )

    expect(drawn.status).toEqual({
      status: "failed",
      reason:
        "Fifty moves have passed with no capture and no pawn moved. The game is a draw.",
    })
    expect(engineThinking(drawn)).toBe(false)
  })

  // Delete the board check from `engineThinking` and every other test here
  // still passes: this is the one that holds it.
  it("asks the defender nothing about a Position with no move left in it", () => {
    const solved = run(opened(MATE_IN_ONE), move("g1", "g7"))

    expect(solved.status.status).toBe("solved")
    expect(engineThinking(solved)).toBe(false)
  })

  it("takes no move from the Student once the budget is spent, defender answered or not", () => {
    const spent = run(opened(FOOLS, 1), move("e7", "e5"))

    const after = run(answered(spent, "g2", "g4"), move("d8", "h4"))

    expect(sans(after)).toEqual(["e5", "g4"])
  })
})

describe("the defending engine", () => {
  it("appends the engine's reply to the line, so the Student sees what it defended with", () => {
    const state = answered(run(opened(FOOLS, 2), move("e7", "e5")), "g2", "g4")

    expect(sans(state)).toEqual(["e5", "g4"])
    expect(state.fen).toBe(
      "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"
    )
  })

  it("is thinking from the Student's move until the reply lands, and not before or after", () => {
    const opening = opened(FOOLS, 2)
    expect(engineThinking(opening)).toBe(false)

    const played = run(opening, move("e7", "e5"))
    expect(engineThinking(played)).toBe(true)

    expect(engineThinking(answered(played, "g2", "g4"))).toBe(false)
  })

  it("takes no move from the Student while it is the engine's to make", () => {
    const waiting = run(opened(FOOLS, 2), move("e7", "e5"))

    const after = run(waiting, move("g2", "g4"))

    expect(sans(after)).toEqual(["e5"])
    expect(after.refusal).toBeNull()
  })

  it("solves the Puzzle when the mate lands against the defence, inside the budget", () => {
    const state = run(
      answered(run(opened(FOOLS, 2), move("e7", "e5")), "g2", "g4"),
      move("d8", "h4")
    )

    expect(sans(state)).toEqual(["e5", "g4", "Qh4#"])
    expect(state.status).toEqual({ status: "solved" })
  })

  it("drops a reply to a Position the Puzzle has left, rather than answering the wrong board", () => {
    const askedAboutE5 = run(opened(FOOLS, 2), move("e7", "e5"))
    // The Student took that move back and played another; g4 was chosen
    // against a Position that is no longer on the board, and is still legal
    // on this one, which is exactly what makes it dangerous.
    const askedAboutD5 = run(askedAboutE5, { type: "rewind" }, move("d7", "d5"))

    const after = playReducer(askedAboutD5, {
      type: "engine_move",
      fen: askedAboutE5.fen,
      from: "g2",
      to: "g4",
    })

    expect(sans(after)).toEqual(["d5"])
    expect(engineThinking(after)).toBe(true)
  })

  it("drops a failure about a Position the Puzzle has left, so a live search is not blamed", () => {
    const askedAboutE5 = run(opened(FOOLS, 2), move("e7", "e5"))
    const askedAboutD5 = run(askedAboutE5, { type: "rewind" }, move("d7", "d5"))

    // The timeout belongs to the abandoned search; the one about this Position
    // is still running, and the board must stay waiting on it.
    const after = playReducer(askedAboutD5, {
      type: "engine_failed",
      fen: askedAboutE5.fen,
    })

    expect(after.engineFailure).toBeNull()
    expect(engineThinking(after)).toBe(true)
  })

  it("plays the piece a promoting defender chose, rather than refusing its reply", () => {
    const state = answered(
      run(opened(DEFENDER_PROMOTES, 2), move("h1", "h2")),
      "a2",
      "a1",
      "q"
    )

    expect(sans(state)).toEqual(["Rh2", "a1=Q+"])
  })

  it("refuses a reply that is not a legal move, because legality is the client's to say", () => {
    const waiting = run(opened(FOOLS, 2), move("e7", "e5"))

    const after = answered(waiting, "g2", "g6")

    expect(sans(after)).toEqual(["e5"])
    expect(after.engineFailure).toBe(
      "The engine sent a move that cannot be played."
    )
  })

  it("hands the board back when the engine goes quiet, rather than waiting on it forever", () => {
    const waiting = run(opened(FOOLS, 2), move("e7", "e5"))

    const quiet = wentQuiet(waiting)

    expect(quiet.engineFailure).toMatch(/The engine is not answering/)
    expect(engineThinking(quiet)).toBe(false)
    // The Position is not lost, and the reply can be played by hand.
    expect(quiet.fen).toBe(waiting.fen)
    expect(sans(run(quiet, move("g2", "g4")))).toEqual(["e5", "g4"])
  })

  it("forgets the engine's silence once play moves on, because it was feedback and not history", () => {
    const quiet = wentQuiet(run(opened(FOOLS, 2), move("e7", "e5")))

    for (const action of [
      move("g2", "g4"),
      { type: "rewind" },
      { type: "reset" },
    ] as Array<PlayAction>) {
      expect(playReducer(quiet, action).engineFailure).toBeNull()
    }
  })
})

describe("Rewind against a defender", () => {
  it("takes back the engine's reply with the Student's move, so it is the Student's turn again", () => {
    const answeredOnce = answered(
      run(opened(FOOLS, 2), move("e7", "e5")),
      "g2",
      "g4"
    )

    const state = run(answeredOnce, { type: "rewind" })

    expect(sans(state)).toEqual([])
    expect(state.fen).toBe(FOOLS)
  })

  it("takes back only the Student's move when the engine has not answered yet", () => {
    const waiting = run(opened(FOOLS, 2), move("e7", "e5"))

    const state = run(waiting, { type: "rewind" })

    expect(sans(state)).toEqual([])
    expect(state.fen).toBe(FOOLS)
  })

  it("leaves the Student to move whatever it takes back, so Rewind is never a pass", () => {
    const deep = run(
      answered(run(opened(FOOLS, 4), move("e7", "e5")), "g2", "g4"),
      move("d7", "d5")
    )
    expect(sans(deep)).toEqual(["e5", "g4", "d5"])

    const state = run(deep, { type: "rewind" })

    expect(sans(state)).toEqual(["e5", "g4"])
    expect(engineThinking(state)).toBe(false)
  })
})
