import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PlayPuzzle } from "@/components/play-puzzle"

import type { PuzzleDraft } from "@/lib/puzzles/rules"

/** White plays Qg7 mate; Black is not already in check, so it is legal too. */
const MATE_IN_ONE: PuzzleDraft = {
  name: "Queen and king mate",
  fen: "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1",
  goal: { kind: "mate_in", n: 1 },
}

/** Black to move, one move into the Fool's Mate: ...e5, g4, Qh4#. */
const BLACKS_TO_SOLVE: PuzzleDraft = {
  name: "Fool's mate",
  fen: "rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1",
  goal: { kind: "mate_in", n: 2 },
}

/**
 * The same Position with two moves of budget, so an attempt survives a ply
 * that is not mate — a spent budget ends the attempt and takes no more moves.
 */
const TWO_MOVES: PuzzleDraft = {
  ...MATE_IN_ONE,
  goal: { kind: "mate_in", n: 2 },
}

/**
 * Play, without a server: the screen is handed a Puzzle and nothing else, so
 * what it does with one is the whole of its contract. The loop itself is
 * `tests/lib/chess/play.test.ts` — here it is only what a Student can see.
 */
describe("the Play screen", () => {
  it("says the Goal in plain words and whose turn it is, because the reader is five", () => {
    render(<PlayPuzzle puzzle={MATE_IN_ONE} />)

    expect(screen.getByText("Checkmate in 1 move")).toBeVisible()
    expect(screen.getByText("White to move")).toBeVisible()
  })

  it("hands the turn over once a move lands, so a Student knows who plays next", () => {
    render(<PlayPuzzle puzzle={TWO_MOVES} />)

    play("g1, white queen", "g8, empty")

    expect(screen.getByText("Black to move")).toBeVisible()
  })

  it("says why an illegal attempt was refused, and stops saying it once a legal move lands", () => {
    render(<PlayPuzzle puzzle={MATE_IN_ONE} />)

    play("f6, white king", "h6, empty")

    expect(screen.getByRole("alert")).toHaveTextContent(
      "A king moves one square at a time, in any direction."
    )
    expect(screen.getByRole("button", { name: "f6, white king" })).toBeVisible()

    play("g1, white queen", "g7, empty")

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  // Rewind and Reset differ only past the Student's first move, which needs
  // the engine's reply on the board — held in `tests/lib/chess/play.test.ts`
  // until the screen can reach two plies.
  it("keeps the line played in notation, and puts it back to the Puzzle's start", () => {
    render(<PlayPuzzle puzzle={TWO_MOVES} />)

    play("g1, white queen", "g8, empty")
    expect(moves()).toEqual(["Qg8+"])

    fireEvent.click(screen.getByRole("button", { name: "Rewind" }))
    expect(moves()).toEqual([])

    play("g1, white queen", "g8, empty")
    fireEvent.click(screen.getByRole("button", { name: "Reset" }))
    expect(moves()).toEqual([])
    expect(screen.getByText("White to move")).toBeVisible()
  })

  it("marks a picked-up piece's squares only while Guidance is on, and says which it is", () => {
    render(<PlayPuzzle puzzle={MATE_IN_ONE} />)
    const guidance = screen.getByRole("checkbox", { name: "Guidance" })

    expect(guidance).toBeChecked()
    tap("g1, white queen")
    expect(marked().length).toBeGreaterThan(0)

    fireEvent.click(guidance)

    expect(guidance).not.toBeChecked()
    expect(marked()).toEqual([])
  })

  it("announces the outcome where it announced the turn, so a Student hears it once", () => {
    render(<PlayPuzzle puzzle={MATE_IN_ONE} />)
    expect(screen.getByRole("status")).toHaveTextContent("White to move")

    play("g1, white queen", "g7, empty")

    expect(screen.getByRole("status")).toHaveTextContent("Solved!")
    expect(screen.queryByText("Black to move")).not.toBeInTheDocument()
  })

  it("says why an attempt ended and offers another go, which starts the Puzzle over", () => {
    render(<PlayPuzzle puzzle={MATE_IN_ONE} />)

    // Legal, and check — but not mate, so the one move the Goal allowed is
    // spent and the attempt is over.
    play("g1, white queen", "g8, empty")

    const outcome = screen.getByRole("status")
    expect(outcome).toHaveTextContent("Not this time")
    expect(outcome).toHaveTextContent(
      "That is 1 move played, and no checkmate."
    )

    fireEvent.click(screen.getByRole("button", { name: "Try again" }))

    expect(moves()).toEqual([])
    expect(screen.getByRole("status")).toHaveTextContent("White to move")
    expect(
      screen.queryByRole("button", { name: "Try again" })
    ).not.toBeInTheDocument()

    // Immediately playable from the start, which is the whole point of the go.
    play("g1, white queen", "g7, empty")
    expect(moves()).toEqual(["Qg7#"])
  })

  it("puts Black's side nearest when the Puzzle is Black's to solve", () => {
    render(<PlayPuzzle puzzle={BLACKS_TO_SOLVE} />)

    const [nearest] = within(
      screen.getByRole("group", { name: "Chess board" })
    ).getAllByRole("button")

    expect(nearest).toHaveAccessibleName("h1, white rook")
  })
})

function tap(name: string) {
  fireEvent.click(screen.getByRole("button", { name }))
}

/**
 * Tap a piece, tap a square — the only gesture this product has. By the square
 * and what stands on it, because Guidance adds its own mark to the name.
 */
function play(from: string, to: string) {
  for (const name of [from, to]) {
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`^${name}(,|$)`) })
    )
  }
}

/** The line so far, as the move list reads it out. */
function moves() {
  return within(screen.getByRole("list", { name: "Moves" }))
    .queryAllByRole("listitem")
    .map((move) => move.textContent)
}

/** The squares Guidance has marked. */
function marked() {
  return screen.queryAllByRole("button", { name: /, can move here$/ })
}
