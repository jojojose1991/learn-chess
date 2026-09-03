import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { MoveBoard } from "@/components/move-board"

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
/** A white pawn one square from the last rank, and a king each so it is legal. */
const PROMOTING = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1"
/** Two white kings: `chess.js` will not generate moves for it at all. */
const UNPLAYABLE = "4k3/8/8/8/8/8/8/K3K3 w - - 0 1"

/**
 * Tap a piece, tap a square. The board draws the Position it is given and
 * never moves a piece itself, so what it emits is an *attempt* — the screen
 * that owns the Position is the one that refuses an illegal one.
 */
describe("moving a piece by tapping", () => {
  it("picks up the piece a tap lands on, so a Student can see what they are moving", () => {
    render(<MoveBoard fen={START} guidance={false} onMove={vi.fn()} />)

    tap("e2, white pawn")

    expect(
      screen.getByRole("button", { name: "e2, white pawn, selected" })
    ).toBeVisible()
  })

  it("puts the piece back down when the same square is tapped again", () => {
    render(<MoveBoard fen={START} guidance={false} onMove={vi.fn()} />)

    tap("e2, white pawn")
    tap("e2, white pawn, selected")

    expect(selected()).toBeNull()
  })

  it("moves the selection to another of your own pieces rather than trying to take it", () => {
    const onMove = vi.fn()
    render(<MoveBoard fen={START} guidance={false} onMove={onMove} />)

    tap("e2, white pawn")
    tap("d2, white pawn")

    expect(selected()).toHaveAccessibleName("d2, white pawn, selected")
    expect(onMove).toHaveBeenCalledTimes(0)
  })

  it("does nothing when a tap starts on an empty square or the waiting side's piece", () => {
    const onMove = vi.fn()
    render(<MoveBoard fen={START} guidance={false} onMove={onMove} />)

    tap("d4, empty")
    tap("e7, black pawn")

    expect(selected()).toBeNull()
    expect(onMove).toHaveBeenCalledTimes(0)
  })

  it("emits the move the second tap asks for", () => {
    const onMove = vi.fn()
    render(<MoveBoard fen={START} guidance={false} onMove={onMove} />)

    tap("e2, white pawn")
    tap("e4, empty")

    expect(onMove).toHaveBeenCalledExactlyOnceWith("e2", "e4")
    expect(selected()).toBeNull()
  })

  it("picks nothing up on a Position that cannot be played, rather than falling over", () => {
    const onMove = vi.fn()
    render(<MoveBoard fen={UNPLAYABLE} guidance onMove={onMove} />)

    tap("a1, white king")
    tap("a2, empty")

    expect(selected()).toBeNull()
    expect(onMove).toHaveBeenCalledTimes(0)
  })

  it("emits an illegal attempt too and moves nothing itself, because refusing it belongs to the screen", () => {
    const onMove = vi.fn()
    render(<MoveBoard fen={START} guidance={false} onMove={onMove} />)

    tap("e2, white pawn")
    tap("e5, empty")

    expect(onMove).toHaveBeenCalledExactlyOnceWith("e2", "e5")
    expect(screen.getByRole("button", { name: "e2, white pawn" })).toBeVisible()
    expect(screen.getByRole("button", { name: "e5, empty" })).toBeVisible()
  })
})

describe("Guidance", () => {
  it("marks exactly the legal destinations of the piece picked up", () => {
    render(<MoveBoard fen={START} guidance onMove={vi.fn()} />)

    tap("g1, white knight")

    const marks = marked()
    expect(marks).toHaveLength(2)
    expect(marks[0]).toHaveAccessibleName("f3, empty, can move here")
    expect(marks[1]).toHaveAccessibleName("h3, empty, can move here")
  })

  it("marks nothing when it is off, so the Student has to find the move", () => {
    render(<MoveBoard fen={START} guidance={false} onMove={vi.fn()} />)

    tap("g1, white knight")

    expect(marked()).toEqual([])
  })

  it("marks the two squares of the last move, so a Student sees what just happened", () => {
    render(
      <MoveBoard
        fen={AFTER_E4}
        guidance
        lastMove={{ from: "e2", to: "e4" }}
        onMove={vi.fn()}
      />
    )

    expect(
      screen.getByRole("button", { name: "e2, empty, last move" })
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "e4, white pawn, last move" })
    ).toBeVisible()
  })
})

describe("the promotion picker", () => {
  it("asks which piece before a promoting pawn moves at all, Queen first", () => {
    render(<MoveBoard fen={PROMOTING} guidance onMove={vi.fn()} />)

    tap("a7, white pawn")
    tap("a8, empty, can move here")

    const choices = within(
      screen.getByRole("dialog", { name: "Promote to" })
    ).getAllByRole("button")

    expect(choices).toHaveLength(4)
    expect(choices[0]).toHaveAccessibleName("Queen")
    expect(choices[1]).toHaveAccessibleName("Rook")
    expect(choices[2]).toHaveAccessibleName("Bishop")
    expect(choices[3]).toHaveAccessibleName("Knight")
  })

  it("offers artwork nobody can drag, the one gesture this product does not have", () => {
    render(<MoveBoard fen={PROMOTING} guidance onMove={vi.fn()} />)

    tap("a7, white pawn")
    tap("a8, empty, can move here")

    const [queen] = within(
      screen.getByRole("dialog", { name: "Promote to" })
    ).getAllByRole("presentation")

    expect(queen).toHaveAttribute("draggable", "false")
  })

  it("sends the chosen piece with the move, so a Rook promotion is not a Queen", () => {
    const onMove = vi.fn()
    render(<MoveBoard fen={PROMOTING} guidance onMove={onMove} />)

    tap("a7, white pawn")
    tap("a8, empty, can move here")
    tap("Rook")

    expect(onMove).toHaveBeenCalledExactlyOnceWith("a7", "a8", "r")
    expect(
      screen.queryByRole("dialog", { name: "Promote to" })
    ).not.toBeInTheDocument()
  })

  it("does not ask on an ordinary pawn move", () => {
    const onMove = vi.fn()
    render(<MoveBoard fen={START} guidance onMove={onMove} />)

    tap("e2, white pawn")
    tap("e3, empty, can move here")

    expect(
      screen.queryByRole("dialog", { name: "Promote to" })
    ).not.toBeInTheDocument()
    expect(onMove).toHaveBeenCalledExactlyOnceWith("e2", "e3")
  })
})

function tap(name: string) {
  fireEvent.click(screen.getByRole("button", { name }))
}

/** The one square that says it is selected, or nothing. */
function selected() {
  return screen.queryByRole("button", { name: /, selected$/ })
}

/** The squares Guidance has marked, in the order the board draws them. */
function marked() {
  return screen.queryAllByRole("button", { name: /, can move here$/ })
}
