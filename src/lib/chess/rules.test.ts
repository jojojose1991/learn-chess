import { Chess } from "chess.js"
import { describe, expect, it } from "vitest"

import { applyMove, legalTargets, validatePosition } from "./rules"

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const CASTLING = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1"
const EN_PASSANT = "rnbqkbnr/pp1ppppp/8/8/2pP4/5N2/PPP1PPPP/RNBQKB1R b - d3 0 3"
const PROMOTING = "8/4P3/8/8/8/8/8/K6k w - - 0 1"

describe("validatePosition", () => {
  it("accepts the starting position", () => {
    expect(validatePosition(START)).toEqual({ ok: true })
  })

  it("rejects a position without exactly two kings", () => {
    expect(validatePosition("8/8/8/8/8/8/8/K7 w - - 0 1")).toEqual({
      ok: false,
      reasons: ["Black has no king."],
    })
    expect(validatePosition("kk6/8/8/8/8/8/8/K7 w - - 0 1")).toEqual({
      ok: false,
      reasons: ["Black has more than one king."],
    })
  })

  it("rejects a pawn on the first or last rank", () => {
    const reasons = ["A pawn cannot stand on the first or the last rank."]
    expect(validatePosition("k6P/8/8/8/8/8/8/K7 w - - 0 1")).toEqual({
      ok: false,
      reasons,
    })
    expect(validatePosition("k7/8/8/8/8/8/8/K6p w - - 0 1")).toEqual({
      ok: false,
      reasons,
    })
  })

  it("rejects the side not to move being in check", () => {
    expect(validatePosition("k6R/8/8/8/8/8/8/K7 w - - 0 1")).toEqual({
      ok: false,
      reasons: ["Black is in check, but it is White's turn to move."],
    })
    expect(validatePosition("k7/8/8/8/8/8/8/K6r b - - 0 1")).toEqual({
      ok: false,
      reasons: ["White is in check, but it is Black's turn to move."],
    })
  })

  it("rejects more than eight pawns a side", () => {
    expect(validatePosition("k7/8/8/8/8/P7/PPPPPPPP/K7 w - - 0 1")).toEqual({
      ok: false,
      reasons: ["White has more than eight pawns."],
    })
    expect(validatePosition("k7/pppppppp/p7/8/8/8/8/K7 w - - 0 1")).toEqual({
      ok: false,
      reasons: ["Black has more than eight pawns."],
    })
  })

  it("reports every reason a position fails, not just the first", () => {
    const result = validatePosition("k6R/pppppppp/p7/8/8/8/8/K7 w - - 0 1")
    expect(result).toEqual({
      ok: false,
      reasons: [
        "Black has more than eight pawns.",
        "Black is in check, but it is White's turn to move.",
      ],
    })
  })

  it("rejects a string that is not a position at all", () => {
    expect(validatePosition("not a position")).toEqual({
      ok: false,
      reasons: ["That is not a legal position."],
    })
  })
})

describe("what a Position keeps", () => {
  it("round-trips castling rights and a usable en-passant square", () => {
    for (const fen of [CASTLING, EN_PASSANT]) {
      expect(validatePosition(fen)).toEqual({ ok: true })
      expect(new Chess(fen).fen()).toBe(fen)
    }
  })

  it("drops an en-passant square no pawn can use", () => {
    // chess.js normalises it away on load. Harmless — it changes no legal
    // move — but a stored Position does not come back byte for byte, and
    // `fen({ forceEnpassantSquare: true })` only helps on load, never after
    // a move, which clears the square outright.
    const unusable = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b - d3 0 1"
    expect(new Chess(unusable).fen()).toBe(
      "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b - - 0 1"
    )
  })

  it("carries both through a move", () => {
    expect(applyMove(CASTLING, "a2", "a3")).toEqual({
      ok: true,
      fen: "r3k2r/pppppppp/8/8/8/P7/1PPPPPPP/R3K2R b KQkq - 0 1",
      san: "a3",
    })

    expect(applyMove(EN_PASSANT, "c4", "d3")).toEqual({
      ok: true,
      fen: "rnbqkbnr/pp1ppppp/8/8/8/3p1N2/PPP1PPPP/RNBQKB1R w - - 0 4",
      san: "cxd3",
    })
  })
})

describe("legalTargets", () => {
  it("lists where the piece on a square may go", () => {
    expect(legalTargets(START, "g1").sort()).toEqual(["f3", "h3"])
  })

  it("is empty for an empty square", () => {
    expect(legalTargets(START, "e5")).toEqual([])
  })

  it("is empty for the opponent's piece", () => {
    expect(legalTargets(START, "e7")).toEqual([])
  })

  it("includes the castling destinations", () => {
    expect(legalTargets(CASTLING, "e1").sort()).toEqual([
      "c1",
      "d1",
      "f1",
      "g1",
    ])
  })

  it("includes the en-passant destination", () => {
    expect(legalTargets(EN_PASSANT, "c4").sort()).toEqual(["c3", "d3"])
  })

  it("lists a promotion square once, not once per piece", () => {
    expect(legalTargets(PROMOTING, "e7")).toEqual(["e8"])
  })
})

describe("applyMove", () => {
  it("returns the resulting position and its notation", () => {
    expect(applyMove(START, "e2", "e4")).toEqual({
      ok: true,
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      san: "e4",
    })
  })

  it("rejects an illegal move", () => {
    expect(applyMove(START, "e2", "e5")).toEqual({
      ok: false,
      reason: "e2 to e5 is not a legal move in this position.",
    })
  })

  it("rejects a move that would leave the mover's own king in check", () => {
    const pinned = "4r2k/8/8/8/8/8/4B3/4K3 w - - 0 1"
    expect(applyMove(pinned, "e2", "d3")).toEqual({
      ok: false,
      reason: "e2 to d3 is not a legal move in this position.",
    })
  })

  it("promotes to the chosen piece", () => {
    expect(applyMove(PROMOTING, "e7", "e8", "n")).toEqual({
      ok: true,
      fen: "4N3/8/8/8/8/8/8/K6k b - - 0 1",
      san: "e8=N",
    })
  })

  it("never silently queens a promotion with no piece chosen", () => {
    expect(applyMove(PROMOTING, "e7", "e8")).toEqual({
      ok: false,
      reason: "e7 to e8 is not a legal move in this position.",
    })
  })
})
