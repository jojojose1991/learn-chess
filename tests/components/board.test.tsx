import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Board } from "@/components/board"

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

/**
 * Every square is a button named for its coordinate and what stands on it,
 * which is both the a11y baseline and the only handle these tests need.
 */
describe("the board", () => {
  it("draws a Position with each piece on its own square", () => {
    render(<Board fen={START} onSquareTap={() => {}} />)

    expect(screen.getByRole("button", { name: "a1, white rook" })).toBeVisible()
    expect(screen.getByRole("button", { name: "e8, black king" })).toBeVisible()
    expect(screen.getByRole("button", { name: "d4, empty" })).toBeVisible()
  })

  it("makes every square a tap target, so a Coach can place a piece on a bare one", () => {
    render(<Board fen={START} onSquareTap={() => {}} />)

    expect(screen.getAllByRole("button")).toHaveLength(64)
  })

  it("emits the square that was tapped and nothing else about it", () => {
    const onSquareTap = vi.fn()
    render(<Board fen={START} onSquareTap={onSquareTap} />)

    tap("e2, white pawn")
    tap("e4, empty")

    expect(onSquareTap).toHaveBeenNthCalledWith(1, "e2")
    expect(onSquareTap).toHaveBeenNthCalledWith(2, "e4")
  })

  it("reverses the board for Black, so the Student's own pieces are nearest", () => {
    render(<Board fen={START} orientation="black" onSquareTap={() => {}} />)

    const squares = screen.getAllByRole("button")

    expect(squares[0]).toHaveAccessibleName("h1, white rook")
    expect(squares[63]).toHaveAccessibleName("a8, black rook")
  })

  it("lets nothing be dragged, because a five-year-old on a touchscreen drags badly", () => {
    render(<Board fen={START} onSquareTap={() => {}} />)

    // The gesture the browser gives away for free; written handlers are
    // `eslint.config.js`'s job.
    const [piece] = screen.getAllByRole("presentation")

    expect(piece).toHaveAttribute("draggable", "false")
  })

  it("marks the hinted piece and says what the mark means, because a Hint is never the move", () => {
    render(<Board fen={START} hint="g1" onSquareTap={() => {}} />)

    expect(
      screen.getByRole("button", { name: "g1, white knight, try this piece" })
    ).toBeVisible()
    // One square in the whole board: a Hint names a piece and stops there.
    expect(
      screen.getAllByRole("button", { name: /, try this piece$/ })
    ).toHaveLength(1)
  })

  it("draws each coordinate on the square it names, so a flip cannot desync them", () => {
    const { unmount } = render(<Board fen={START} onSquareTap={() => {}} />)

    expect(labelsOn("a8, black rook")).toEqual(["8"])
    expect(labelsOn("a1, white rook")).toEqual(["1", "a"])
    expect(labelsOn("h1, white rook")).toEqual(["h"])
    unmount()

    render(<Board fen={START} orientation="black" onSquareTap={() => {}} />)

    expect(labelsOn("h1, white rook")).toEqual(["1"])
    expect(labelsOn("h8, black rook")).toEqual(["8", "h"])
    expect(labelsOn("a8, black rook")).toEqual(["a"])
  })
})

function tap(name: string) {
  fireEvent.click(screen.getByRole("button", { name }))
}

/** The coordinates a square carries, in the order they are drawn on it. */
function labelsOn(name: string) {
  return within(screen.getByRole("button", { name }))
    .getAllByText(/^[a-h1-8]$/)
    .map((label) => label.textContent)
}
