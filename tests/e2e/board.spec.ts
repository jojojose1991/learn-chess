import { expect, test } from "@playwright/test"

import type { Page } from "@playwright/test"

import { boardOf, squareExactly, trayOf } from "./board"
import { openNewPuzzle } from "./coach"

/**
 * Squareness is the one board behaviour no layer below can hold: jsdom
 * computes no layout, so a unit test could only read the class string back.
 *
 * Confirm & Edit is where the board lives now, so that is where it is
 * measured — an empty board is still a board, and the pieces it can draw are
 * the tray's, which is the same twelve files.
 */

for (const viewport of [
  { width: 390, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`stays square at ${viewport.width}px, because the board is the hero`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await openNewPuzzle(page)

    const box = await boardOf(page).boundingBox()

    expect(box).not.toBeNull()
    expect(box!.width).toBeCloseTo(box!.height, 0)
  })
}

test("fills the width its screen allows, so the board is the hero", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openNewPuzzle(page)

  const box = await boardOf(page).boundingBox()

  // A floor rather than an exact width, because the exact one is whatever
  // `max-w-*` the screen chose. `mx-auto` on a flex-column child shrinks to
  // fit its content, which drew the hero at 131px until `_coach.tsx` stopped
  // making the screen a flex child — and squareness alone cannot catch that,
  // because 131 by 131 is square.
  expect(box!.width).toBeGreaterThan(500)
})

/**
 * Three things below a real browser cannot hold, all of them found by mutating
 * the component and watching the unit suite stay green: `isLight` returning a
 * constant, the theme class going to the wrong palette, and every piece
 * drawing in the opposite colour. The two hex pairs are issue 06's own product
 * decision, so asserting them is asserting the spec.
 */
test("checkers the squares in green, the default theme", async ({ page }) => {
  await openNewPuzzle(page)
  const board = boardOf(page)

  // a1 is dark and its neighbour is light: parity has an off-by-one each side.
  await expect(squareExactly(board, "a1, empty")).toHaveCSS(
    "background-color",
    "rgb(119, 153, 82)"
  )
  await expect(squareExactly(board, "b1, empty")).toHaveCSS(
    "background-color",
    "rgb(237, 238, 209)"
  )
  await expect(squareExactly(board, "a8, empty")).toHaveCSS(
    "background-color",
    "rgb(237, 238, 209)"
  )
})

test("draws the artwork, so a sighted Coach sees what they are placing", async ({
  page,
}) => {
  await openNewPuzzle(page)
  const tray = trayOf(page)
  const pieces = tray.locator("img")

  await expect(pieces).toHaveCount(12)
  // Every file resolves. A renamed piece, a missing SVG or a wrong public
  // path draws twelve broken images with the whole unit suite green, because
  // the accessible name never touches the filename.
  const loaded = await pieces.evaluateAll((images) =>
    images.every((image) => (image as HTMLImageElement).naturalWidth > 0)
  )
  expect(loaded).toBe(true)

  // And the right piece, not merely a piece: both colours reach the board.
  await place(page, "white rook", "a1")
  await place(page, "black king", "e8")
  await expect(
    squareExactly(boardOf(page), "a1, white rook").locator("img")
  ).toHaveAttribute("src", "/pieces/wR.svg")
  await expect(
    squareExactly(boardOf(page), "e8, black king").locator("img")
  ).toHaveAttribute("src", "/pieces/bK.svg")
})

/** Choose a piece in the tray, then tap the square it goes on. */
async function place(page: Page, piece: string, coordinate: string) {
  await trayOf(page).getByRole("radio", { name: piece }).click()
  await boardOf(page)
    .getByRole("button", { name: new RegExp(`^${coordinate},`) })
    .click()
}

/**
 * The 44px floor is `docs/PLAN.md`'s, and only a browser can hold it: jsdom
 * computes no layout, so a unit test could read back the class string and
 * nothing else.
 */
test("keeps a square at 44px on a phone, because the person tapping is five", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await openNewPuzzle(page)

  const box = await squareExactly(boardOf(page), "a1, empty").boundingBox()

  expect(box!.width).toBeGreaterThanOrEqual(44)
  expect(box!.height).toBeGreaterThanOrEqual(44)
})
