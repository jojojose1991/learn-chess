import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { PuzzleEditor } from "@/components/puzzle-editor"

/** White plays Qg7 mate; Black is not already in check, so it is legal too. */
const MATE_IN_ONE = "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1"

const saved = () => vi.fn().mockResolvedValue({})

/**
 * Confirm & Edit, without the server. A Coach places pieces, says whose turn
 * it is and what the Goal is; what leaves this component is one draft, which
 * is the whole of its contract.
 */
describe("building a Puzzle by hand", () => {
  it("opens on a board with nothing on it, so a Coach starts from empty", () => {
    render(<PuzzleEditor onSave={saved()} />)

    expect(screen.getAllByRole("button", { name: /, empty$/ })).toHaveLength(64)
    expect(screen.getByRole("radio", { name: "White" })).toBeChecked()
  })

  it("puts the tray's piece on the square that was tapped", () => {
    render(<PuzzleEditor onSave={saved()} />)

    place("white king", "e1")

    expect(screen.getByRole("button", { name: "e1, white king" })).toBeVisible()
  })

  it("takes a piece off when the tray says empty, so nothing depends on unseen state", () => {
    render(<PuzzleEditor onSave={saved()} />)

    place("white king", "e1")
    place("empty", "e1")

    expect(screen.getByRole("button", { name: "e1, empty" })).toBeVisible()
  })

  it("turns the board around without moving a piece, so a Coach can look from Black's side", () => {
    render(<PuzzleEditor onSave={saved()} />)
    place("white king", "e1")

    fireEvent.click(screen.getByRole("button", { name: "Flip board" }))

    expect(squares()[0]).toHaveAccessibleName("h1, empty")
    expect(screen.getByRole("button", { name: "e1, white king" })).toBeVisible()
  })
})

describe("the validity check, which is visible and blocking", () => {
  it("says what is wrong with the Position and refuses to save it", () => {
    render(<PuzzleEditor onSave={saved()} />)

    expect(screen.getByText("White has no king.")).toBeVisible()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    // Play is refused on the same grounds and not on Save's alone: a Position
    // that cannot be played is exactly the one nobody may play (docs/PLAN.md).
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled()
  })

  it("lets the Puzzle be saved once nothing is wrong with the Position", () => {
    render(<PuzzleEditor onSave={saved()} />)

    place("white king", "f6")
    place("black king", "h8")
    place("white queen", "g1")

    expect(screen.queryByText(/has no king/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled()
  })

  it("takes the Coach's word for whose turn it is, and re-checks the Position on it", () => {
    render(<PuzzleEditor onSave={saved()} />)

    place("white king", "e1")
    place("black king", "e8")
    place("white rook", "e7")

    const inCheck = "Black is in check, but it is White's turn to move."
    expect(screen.getByText(inCheck)).toBeVisible()

    fireEvent.click(screen.getByRole("radio", { name: "Black" }))

    expect(screen.queryByText(inCheck)).not.toBeInTheDocument()
  })
})

describe("saving", () => {
  it("hands over the Position, the side to move, the Goal and the name", () => {
    const onSave = saved()
    render(<PuzzleEditor onSave={onSave} />)

    place("white king", "f6")
    place("black king", "h8")
    place("white queen", "g1")
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "  Back rank mate  " },
    })
    fireEvent.change(screen.getByLabelText("Mate in"), {
      target: { value: "2" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(onSave).toHaveBeenCalledExactlyOnceWith(
      {
        name: "  Back rank mate  ",
        fen: MATE_IN_ONE,
        goal: { kind: "mate_in", n: 2 },
      },
      "library"
    )
  })

  it("writes the Puzzle before playing it, so Play never opens a Position the Coach has moved on from", () => {
    const onSave = saved()
    render(<PuzzleEditor onSave={onSave} />)

    place("white king", "f6")
    place("black king", "h8")
    place("white queen", "g1")
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Back rank mate" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Play" }))

    expect(onSave).toHaveBeenCalledExactlyOnceWith(
      {
        name: "Back rank mate",
        fen: MATE_IN_ONE,
        goal: { kind: "mate_in", n: 1 },
      },
      "play"
    )
  })

  it("does not carry a Play the browser refused over into the next Save", () => {
    const onSave = saved()
    render(<PuzzleEditor onSave={onSave} />)

    place("white king", "f6")
    place("black king", "h8")
    place("white queen", "g1")
    // No name yet, so the browser's own `required` refuses this submit before
    // the editor ever sees it.
    fireEvent.click(screen.getByRole("button", { name: "Play" }))
    expect(onSave).toHaveBeenCalledTimes(0)

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Back rank mate" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(onSave).toHaveBeenCalledExactlyOnceWith(
      {
        name: "Back rank mate",
        fen: MATE_IN_ONE,
        goal: { kind: "mate_in", n: 1 },
      },
      "library"
    )
  })

  it("shows what the server refused, rather than looking as though it saved", async () => {
    const onSave = vi.fn().mockResolvedValue({ error: "That did not work." })
    render(<PuzzleEditor onSave={onSave} />)

    place("white king", "f6")
    place("black king", "h8")
    place("white queen", "g1")
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Back rank mate" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That did not work."
    )
  })

  it("offers Save again when the write never got an answer, so a dropped connection is not the end of the Puzzle", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Failed to fetch"))
    render(<PuzzleEditor onSave={onSave} />)

    place("white king", "f6")
    place("black king", "h8")
    place("white queen", "g1")
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Back rank mate" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByRole("alert")).toBeVisible()
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled()
  })
})

describe("reopening a saved Puzzle", () => {
  it("comes back with the same Position, side to move and Goal", () => {
    render(
      <PuzzleEditor
        puzzle={{
          name: "Back rank mate",
          fen: "7k/8/5K2/8/8/8/8/6Q1 b - - 0 1",
          goal: { kind: "mate_in", n: 3 },
        }}
        onSave={saved()}
      />
    )

    expect(screen.getByRole("button", { name: "h8, black king" })).toBeVisible()
    expect(
      screen.getByRole("button", { name: "g1, white queen" })
    ).toBeVisible()
    expect(screen.getByRole("radio", { name: "Black" })).toBeChecked()
    expect(screen.getByLabelText("Mate in")).toHaveValue(3)
    expect(screen.getByLabelText("Name")).toHaveValue("Back rank mate")
  })
})

/** Choose a piece in the tray, then tap the square it goes on. */
function place(piece: string, square: string) {
  fireEvent.click(screen.getByRole("radio", { name: piece }))
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(`^${square},`) })
  )
}

function squares() {
  return within(
    screen.getByRole("group", { name: "Chess board" })
  ).getAllByRole("button")
}
