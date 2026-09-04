import { Chess } from "chess.js"
import { describe, expect, it } from "vitest"

import {
  EMPTY_POSITION,
  applyMove,
  explainIllegal,
  isPromotion,
  legalTargets,
  pieceToMove,
  readPlacement,
  validatePosition,
  withPiece,
  withSideToMove,
} from "@/lib/chess/rules"

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

describe("explainIllegal", () => {
  it("says when there is no piece on the square", () => {
    expect(explainIllegal(START, "e5", "e6")).toBe(
      "There is no piece on that square."
    )
  })

  it("says when the piece belongs to the other side", () => {
    expect(explainIllegal(START, "e7", "e6")).toBe("That is not your piece.")
  })

  it("says when one of your own pieces is already there", () => {
    expect(explainIllegal(START, "a1", "a2")).toBe(
      "One of your own pieces is already on that square."
    )
  })

  it("says how the piece moves when it could never reach the square", () => {
    expect(explainIllegal(START, "b1", "e5")).toBe(
      "A knight moves in an L: two squares one way, then one square across."
    )
    expect(explainIllegal(START, "c1", "c3")).toBe(
      "A bishop moves only along the slanted lines, never straight."
    )
    expect(explainIllegal(START, "e2", "d3")).toBe(
      "A pawn moves straight forward, and only takes a piece diagonally."
    )
  })

  it("says when a piece is in the way", () => {
    expect(explainIllegal(START, "a1", "a5")).toBe(
      "There is a piece in the way."
    )
  })

  it("says when the move would expose your own king", () => {
    const pinned = "4r3/8/8/8/8/8/4R3/4K2k w - - 0 1"
    expect(explainIllegal(pinned, "e2", "d2")).toBe(
      "That would leave your king in danger."
    )
  })

  it("says the same when the king itself would step into danger", () => {
    const attacked = "8/8/8/8/8/8/1r6/4K2k w - - 0 1"
    expect(explainIllegal(attacked, "e1", "e2")).toBe(
      "That would leave your king in danger."
    )
  })

  it("does not mistake a castle it cannot make for a two-square king move", () => {
    const noRights = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w - - 0 1"
    expect(explainIllegal(noRights, "e1", "g1")).toBe(
      "Your king cannot castle right now."
    )
  })
})

describe("explainIllegal, on the cases the first cut got wrong", () => {
  it("blames the pin, not the pawn, for a pinned pawn's capture", () => {
    // exd3 is a real pawn capture; it is illegal only because the pawn is
    // pinned to e1 by the rook on e8.
    const pinnedPawn = "4rk2/8/8/8/8/3n4/4P3/4K3 w - - 0 1"
    expect(explainIllegal(pinnedPawn, "e2", "d3")).toBe(
      "That would leave your king in danger."
    )
  })

  it("says a blocked pawn is blocked", () => {
    const blocked = "4k3/8/8/8/8/4n3/4P3/4K3 w - - 0 1"
    expect(explainIllegal(blocked, "e2", "e4")).toBe(
      "There is a piece in the way."
    )
  })

  it("tells a pawn it cannot take the piece standing in front of it", () => {
    const facing = "4k3/8/8/8/8/4n3/4P3/4K3 w - - 0 1"
    const reason =
      "A pawn cannot take a piece straight ahead — only diagonally."
    expect(explainIllegal(facing, "e2", "e3")).toBe(reason)
    // Two squares ahead, with the square between it empty: same truth.
    expect(
      explainIllegal("4k3/8/8/8/4n3/8/4P3/4K3 w - - 0 1", "e2", "e4")
    ).toBe(reason)
  })

  it("does not blame the other side's piece on your own pieces", () => {
    // The rook is stopped by the knight in its path; the black rook it was
    // going for is on the destination, and belongs to nobody friendly.
    const stopped = "7k/8/8/4r3/8/4n3/8/K3R3 w - - 0 1"
    expect(explainIllegal(stopped, "e1", "e5")).toBe(
      "There is a piece in the way."
    )
  })

  it("does not call an impossible move blocked just because the board is full", () => {
    expect(explainIllegal(START, "a1", "c3")).toBe(
      "A rook moves only in straight lines, up and down or side to side."
    )
  })

  it("only calls it a castle when the king is on its own square", () => {
    const roaming = "7k/8/8/8/4K3/8/8/8 w - - 0 1"
    expect(explainIllegal(roaming, "e4", "g4")).toBe(
      "A king moves one square at a time, in any direction."
    )
  })
})

describe("readPlacement", () => {
  it("puts each piece of a Position on its own square", () => {
    const placement = new Map(
      readPlacement(START).map(({ square, piece }) => [square, piece])
    )

    expect(placement.get("a1")).toMatchObject({ type: "r", color: "w" })
    expect(placement.get("e8")).toMatchObject({ type: "k", color: "b" })
    expect(placement.get("d4")).toBeNull()
  })

  it("reads a Position that validatePosition rejects, because Confirm & Edit draws an invalid board while refusing to play it", () => {
    const kingless = "8/8/8/8/8/8/8/R7 w - - 0 1"
    expect(validatePosition(kingless).ok).toBe(false)

    const [first] = readPlacement(kingless).filter(({ piece }) => piece)
    expect(first).toMatchObject({ square: "a1", piece: { type: "r" } })
  })

  it("returns all sixty-four squares, empties included, from a8 to h1", () => {
    const squares = readPlacement(START).map(({ square }) => square)

    expect(squares).toHaveLength(64)
    expect(squares[0]).toBe("a8")
    expect(squares[7]).toBe("h8")
    expect(squares[56]).toBe("a1")
    expect(squares[63]).toBe("h1")
  })
})

describe("legalTargets and a pinned piece", () => {
  it("leaves out the moves that would expose the king, so Guidance marks legal squares and not merely reachable ones", () => {
    // The pawn on d2 stands between the bishop on a5 and its own king on e1.
    // d3 and d4 are both squares it could otherwise reach — a generator that
    // skipped the check filter would mark them.
    const pinned = "4k3/8/8/b7/8/8/3P4/4K3 w - - 0 1"

    expect(legalTargets(pinned, "d2")).toEqual([])
  })
})

describe("pieceToMove", () => {
  it("hands back the piece a tap may pick up, which is the side to move's", () => {
    expect(pieceToMove(START, "e2")).toMatchObject({ type: "p", color: "w" })
  })

  it("hands back nothing for an empty square, so a tap on one starts no move", () => {
    expect(pieceToMove(START, "e4")).toBeNull()
  })

  it("hands back nothing for the waiting side's piece, so a Student cannot move their opponent", () => {
    expect(pieceToMove(START, "e7")).toBeNull()
  })
})

describe("isPromotion", () => {
  it("says a pawn reaching the last rank must be asked which piece", () => {
    expect(isPromotion(PROMOTING, "e7", "e8")).toBe(true)
  })

  it("says the same pawn a rank short is an ordinary move", () => {
    const short = "8/8/4P3/8/8/8/8/K6k w - - 0 1"
    expect(isPromotion(short, "e6", "e7")).toBe(false)
  })

  it("says a promotion for Black too, whose last rank is the first", () => {
    const black = "K6k/8/8/8/8/8/4p3/8 b - - 0 1"
    expect(isPromotion(black, "e2", "e1")).toBe(true)
  })

  it("says no for a move that is illegal anyway, so no picker opens on one", () => {
    expect(isPromotion(PROMOTING, "e7", "d8")).toBe(false)
  })
})

/**
 * Building a Position by hand, which is the whole of Confirm & Edit: a Coach
 * places pieces and says whose turn it is, and never enters a move.
 */
describe("editing a Position", () => {
  const WHITE_KING = { type: "k", color: "w" } as const
  const BLACK_KING = { type: "k", color: "b" } as const

  it("starts from a board with nothing on it, White to move", () => {
    expect(readPlacement(EMPTY_POSITION).every(({ piece }) => !piece)).toBe(
      true
    )
    expect(withSideToMove(EMPTY_POSITION, "w")).toBe(EMPTY_POSITION)
  })

  it("puts a piece on the square the Coach tapped", () => {
    const fen = withPiece(EMPTY_POSITION, "e1", WHITE_KING)

    expect(
      readPlacement(fen).find(({ square }) => square === "e1")?.piece
    ).toMatchObject(WHITE_KING)
  })

  it("takes the piece off again, so removing one needs no eraser", () => {
    const placed = withPiece(EMPTY_POSITION, "e1", WHITE_KING)

    expect(withPiece(placed, "e1", null)).toBe(EMPTY_POSITION)
  })

  it("replaces what stood there, rather than refusing an occupied square", () => {
    const placed = withPiece(EMPTY_POSITION, "e1", WHITE_KING)

    expect(withPiece(placed, "e1", BLACK_KING)).toBe(
      withPiece(EMPTY_POSITION, "e1", BLACK_KING)
    )
  })

  it("drops the castling rights a removed rook carried, so no Position claims a castle it cannot make", () => {
    expect(withPiece(CASTLING, "h1", null)).toBe(
      "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K3 w Qkq - 0 1"
    )
  })

  it("moves the king a side already has, rather than refusing a Coach who put it on the wrong square", () => {
    const kings = withPiece(
      withPiece(EMPTY_POSITION, "e1", WHITE_KING),
      "e8",
      BLACK_KING
    )

    expect(withPiece(kings, "a1", WHITE_KING)).toBe(
      withPiece(withPiece(EMPTY_POSITION, "a1", WHITE_KING), "e8", BLACK_KING)
    )
  })

  it("keeps the castling rights of a king put back where it already stood", () => {
    // Moving the king is what clears them, and `chess.js` clears them on the
    // `remove` — so a king dropped on its own square would strip KQ with the
    // placement byte for byte the same.
    expect(withPiece(CASTLING, "e1", WHITE_KING)).toBe(CASTLING)
  })

  it("changes whose turn it is, which is the Coach's to say and never a move's", () => {
    const black = withSideToMove(EMPTY_POSITION, "b")

    expect(black).toBe("8/8/8/8/8/8/8/8 b - - 0 1")
    expect(withSideToMove(black, "w")).toBe(EMPTY_POSITION)
  })

  it("clears an en-passant capture the side now to move was never offered", () => {
    expect(withSideToMove(EN_PASSANT, "w")).toBe(
      "rnbqkbnr/pp1ppppp/8/8/2pP4/5N2/PPP1PPPP/RNBQKB1R w - - 0 1"
    )
  })

  it("keeps castling rights, which whose turn it is says nothing about", () => {
    expect(withSideToMove(CASTLING, "b")).toBe(
      "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1"
    )
  })
})
