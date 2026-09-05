import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { CornerPicker, loupeBackground } from "@/components/corner-picker"

/** The keystoned fixture's own size, so the emitted corners are real pixels. */
const PICTURE = { src: "blob:a-board", width: 800, height: 860 }

const picker = (onCorners = vi.fn()) => {
  render(<CornerPicker {...PICTURE} reading={false} onCorners={onCorners} />)
  return onCorners
}

const handle = (corner: string) =>
  screen.getByRole("button", { name: new RegExp(`^${corner} corner`) })

/**
 * Four handles a Coach drags onto a photographed board. The dragging itself
 * needs a browser — jsdom lays nothing out, so a pointer at a coordinate is a
 * coordinate in an empty room — and lives in `tests/e2e/scan.spec.ts` with the
 * loupe. What is held here is everything a keyboard can reach, which is the
 * same state by a different door.
 */
describe("putting four corners on a board", () => {
  it("starts with a handle at each corner of the picture, each saying where it is — a corner nobody can see is a corner nobody can place", () => {
    picker()

    // Inset from the edge, so all four are visible and grabbable before the
    // Coach has touched any of them.
    expect(handle("Top left")).toHaveAccessibleName(
      "Top left corner, 10.0% across and 10.0% down"
    )
    expect(handle("Top right")).toHaveAccessibleName(
      "Top right corner, 90.0% across and 10.0% down"
    )
    expect(handle("Bottom right")).toHaveAccessibleName(
      "Bottom right corner, 90.0% across and 90.0% down"
    )
    expect(handle("Bottom left")).toHaveAccessibleName(
      "Bottom left corner, 10.0% across and 90.0% down"
    )
  })

  it("moves a handle a tenth of a percent at a time, which is a tenth of the slop the read can take", () => {
    picker()

    fireEvent.keyDown(handle("Top left"), { key: "ArrowRight" })
    fireEvent.keyDown(handle("Top left"), { key: "ArrowDown" })
    fireEvent.keyDown(handle("Top left"), { key: "ArrowDown" })

    expect(handle("Top left")).toHaveAccessibleName(
      "Top left corner, 10.1% across and 10.2% down"
    )
  })

  it("moves it ten times as far with Shift held, so crossing the picture is not forty presses", () => {
    picker()

    fireEvent.keyDown(handle("Top left"), { key: "ArrowRight", shiftKey: true })

    expect(handle("Top left")).toHaveAccessibleName(
      "Top left corner, 11.0% across and 10.0% down"
    )
  })

  it("keeps a handle on the picture, because a corner off the edge is not a corner of the board", () => {
    picker()

    for (let press = 0; press < 12; press++) {
      fireEvent.keyDown(handle("Top left"), {
        key: "ArrowLeft",
        shiftKey: true,
      })
    }

    expect(handle("Top left")).toHaveAccessibleName(
      "Top left corner, 0.0% across and 10.0% down"
    )
  })

  it("hands over all four corners in the picture's own pixels, clockwise from the top left, where the handles were moved to and not where they started", () => {
    const onCorners = picker()

    fireEvent.keyDown(handle("Top left"), { key: "ArrowUp", shiftKey: true })
    fireEvent.click(screen.getByRole("button", { name: "Read these corners" }))

    expect(onCorners).toHaveBeenCalledWith([
      { x: 80, y: 77.4 },
      { x: 720, y: 86 },
      { x: 720, y: 774 },
      { x: 80, y: 774 },
    ])
  })

  it("takes no second set of corners while the first is still being read", () => {
    render(<CornerPicker {...PICTURE} reading onCorners={vi.fn()} />)

    expect(
      screen.getByRole("button", { name: "Read these corners" })
    ).toBeDisabled()
  })
})

/**
 * The loupe is a circle with a cross in it and a picture behind it, and only
 * the picture's offset can be silently wrong: a Coach who cannot see it is
 * placing corners a seventh of a tile out and is never told
 * (docs/learnings/board-recognition.md). Everything else about it a person
 * sees or does not, which is `tests/e2e` and, honestly, an eye.
 */
describe("what the loupe puts under the crosshair", () => {
  it("blows the picture up so the corner under the handle lands in the middle", () => {
    // 112px wide and twice life size, so the middle is 56px in and the corner
    // is at 400 × 2 = 800px of a doubled picture: 56 - 800.
    expect(loupeBackground({ x: 0.5, y: 0.25 }, 800, 600)).toEqual({
      backgroundSize: "1600px 1200px",
      backgroundPosition: "-744px -244px",
    })
  })

  it("holds the top left corner of the picture against the middle too, so the crosshair never lies", () => {
    // Half the loupe hangs off the picture, which is the honest picture of a
    // corner that is at the very edge.
    expect(loupeBackground({ x: 0, y: 0 }, 800, 600).backgroundPosition).toBe(
      "56px 56px"
    )
  })

  it("scales with the picture rather than with what is on screen, because that is what a corner is measured in", () => {
    expect(loupeBackground({ x: 0.5, y: 0.5 }, 4032, 3024)).toEqual({
      backgroundSize: "8064px 6048px",
      backgroundPosition: "-3976px -2968px",
    })
  })
})
