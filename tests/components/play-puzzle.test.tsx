import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PlayPuzzle } from "@/components/play-puzzle"

import type { Square } from "chess.js"
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
    render(<PlayPuzzle puzzle={TWO_MOVES} askEngine={stillThinking} />)

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

  it("plays the engine's answer into the line, so the Student is up against a defender", async () => {
    render(
      <PlayPuzzle puzzle={BLACKS_TO_SOLVE} askEngine={answering("g2", "g4")} />
    )

    play("e7, black pawn", "e5, empty")

    await waitFor(() => expect(moves()).toEqual(["e5", "g4"]))
    expect(screen.getByRole("status")).toHaveTextContent("Black to move")
  })

  it("takes no tap while the engine is thinking, and says that is what it is waiting for", () => {
    render(<PlayPuzzle puzzle={BLACKS_TO_SOLVE} askEngine={stillThinking} />)

    play("e7, black pawn", "e5, empty")

    expect(screen.getByRole("status")).toHaveTextContent(
      "The engine is thinking"
    )
    // Not even picked up: the engine's own pieces are the side to move, and a
    // board that selected one and then swallowed the move would say nothing.
    tap("g2, white pawn")
    expect(
      screen.queryByRole("button", { name: /, selected$/ })
    ).not.toBeInTheDocument()
  })

  it("says the engine went quiet and hands the board back, rather than losing the Position", async () => {
    render(<PlayPuzzle puzzle={BLACKS_TO_SOLVE} askEngine={unreachable} />)

    play("e7, black pawn", "e5, empty")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The engine is not answering"
    )
    // The turn line follows the board, which is now White's — the side the
    // Puzzle did not start with.
    expect(screen.getByRole("status")).toHaveTextContent("White to move")
    // The line is intact and the reply can be played by hand instead.
    play("g2, white pawn", "g4, empty")
    expect(moves()).toEqual(["e5", "g4"])
  })

  it("ignores an abandoned search's answer, even about a Position the Puzzle came back to", async () => {
    const asked: Array<{
      resolve: (move: { from: Square; to: Square }) => void
      reject: (why: Error) => void
    }> = []
    const askEngine = () =>
      new Promise<{ from: Square; to: Square }>((resolve, reject) =>
        asked.push({ resolve, reject })
      )
    render(<PlayPuzzle puzzle={BLACKS_TO_SOLVE} askEngine={askEngine} />)

    play("e7, black pawn", "e5, empty")
    fireEvent.click(screen.getByRole("button", { name: "Rewind" }))
    // The same move again, so the second search is about the very Position the
    // first was — which is all the loop has to tell two answers apart by.
    play("e7, black pawn", "e5, empty")
    expect(asked).toHaveLength(2)

    await act(async () => asked[0].reject(new Error("gave up")))

    // The abandoned search's silence is not the live one's.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(
      "The engine is thinking"
    )

    await act(async () => asked[1].resolve({ from: "g2", to: "g4" }))

    expect(moves()).toEqual(["e5", "g4"])
  })

  it("takes the Student's move and the engine's answer back together, so Rewind is not a pass", async () => {
    render(
      <PlayPuzzle puzzle={BLACKS_TO_SOLVE} askEngine={answering("g2", "g4")} />
    )

    play("e7, black pawn", "e5, empty")
    await waitFor(() => expect(moves()).toEqual(["e5", "g4"]))

    play("d7, black pawn", "d5, empty")
    expect(moves()).toEqual(["e5", "g4", "d5"])

    fireEvent.click(screen.getByRole("button", { name: "Rewind" }))

    // Reset would have emptied the line; Rewind leaves the answer standing.
    expect(moves()).toEqual(["e5", "g4"])
    expect(screen.getByRole("status")).toHaveTextContent("Black to move")
  })

  it("hints the piece the engine would move, and never where it would move it", async () => {
    render(
      <PlayPuzzle puzzle={MATE_IN_ONE} askEngine={answering("g1", "g7")} />
    )

    fireEvent.click(screen.getByRole("button", { name: "Hint" }))

    expect(
      await screen.findByRole("button", {
        name: "g1, white queen, try this piece",
      })
    ).toBeVisible()
    // One square in the whole board and no move played: a Student who is
    // stuck is given the piece, and finds the rest themselves.
    expect(
      screen.getAllByRole("button", { name: /, try this piece$/ })
    ).toHaveLength(1)
    expect(moves()).toEqual([])
  })

  it("drops the hint once the Position moves on, so it cannot point at the wrong board", async () => {
    render(
      <PlayPuzzle puzzle={MATE_IN_ONE} askEngine={answering("g1", "g7")} />
    )

    fireEvent.click(screen.getByRole("button", { name: "Hint" }))
    await screen.findByRole("button", { name: /, try this piece$/ })

    play("g1, white queen", "g7, empty")

    expect(
      screen.queryByRole("button", { name: /, try this piece$/ })
    ).not.toBeInTheDocument()
  })

  it("does not bring the hint back with the Position, so a fresh attempt starts unaided", async () => {
    render(
      <PlayPuzzle puzzle={MATE_IN_ONE} askEngine={answering("g1", "g7")} />
    )

    fireEvent.click(screen.getByRole("button", { name: "Hint" }))
    await screen.findByRole("button", { name: /, try this piece$/ })

    // Qg8+ is legal and it is check, but not mate: the attempt is over, and
    // Try again lands back on the very Position the hint was asked about.
    play("g1, white queen", "g8, empty")
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))

    expect(
      screen.queryByRole("button", { name: /, try this piece$/ })
    ).not.toBeInTheDocument()
  })

  it("drops a hint that lands after the Student moved on, rather than marking the new board", async () => {
    const asked: Array<(move: { from: Square; to: Square }) => void> = []
    const askEngine = () =>
      new Promise<{ from: Square; to: Square }>((resolve) =>
        asked.push(resolve)
      )
    render(<PlayPuzzle puzzle={TWO_MOVES} askEngine={askEngine} />)

    fireEvent.click(screen.getByRole("button", { name: "Hint" }))
    play("g1, white queen", "g8, empty")

    // The engine names g1 — where the queen stood before the Student moved it.
    await act(async () => asked[0]({ from: "g1", to: "g7" }))

    expect(
      screen.queryByRole("button", { name: /, try this piece$/ })
    ).not.toBeInTheDocument()
  })

  it("offers no Hint while the board is not the Student's to move on", () => {
    render(<PlayPuzzle puzzle={TWO_MOVES} askEngine={stillThinking} />)
    const hint = () => screen.getByRole("button", { name: "Hint" })
    expect(hint()).toBeEnabled()

    // The engine's turn: the piece it would name is not one they may touch.
    play("g1, white queen", "g8, empty")

    expect(hint()).toBeDisabled()
  })

  it("offers no Hint once the attempt is over, because there is no move left to make", () => {
    render(<PlayPuzzle puzzle={MATE_IN_ONE} askEngine={stillThinking} />)

    play("g1, white queen", "g7, empty")

    expect(screen.getByRole("status")).toHaveTextContent("Solved!")
    expect(screen.getByRole("button", { name: "Hint" })).toBeDisabled()
  })

  it("says plainly when the engine cannot pick a piece, rather than marking a guess", async () => {
    render(<PlayPuzzle puzzle={MATE_IN_ONE} askEngine={unreachable} />)

    fireEvent.click(screen.getByRole("button", { name: "Hint" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The engine could not pick a piece"
    )
    expect(
      screen.queryByRole("button", { name: /, try this piece$/ })
    ).not.toBeInTheDocument()
  })

  it("puts Black's side nearest when the Puzzle is Black's to solve", () => {
    render(<PlayPuzzle puzzle={BLACKS_TO_SOLVE} />)

    const [nearest] = within(
      screen.getByRole("group", { name: "Chess board" })
    ).getAllByRole("button")

    expect(nearest).toHaveAccessibleName("h1, white rook")
  })
})

/**
 * An engine that answers with that move, however long the real one would take
 * to decide on it. The prop is the screen's contract with the defender: what
 * it does with an answer is here, and where the answer comes from is
 * `tests/e2e/engine.spec.ts`.
 */
const answering = (from: Square, to: Square) => () =>
  Promise.resolve({ from, to })

/** An engine that is still thinking, and always will be. */
const stillThinking = () => new Promise<never>(() => {})

/** An engine that cannot be reached at all. */
const unreachable = () => Promise.reject(new Error("no engine"))

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
