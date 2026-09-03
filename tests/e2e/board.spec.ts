import { expect, test } from "@playwright/test"

import type { Locator } from "@playwright/test"

import { signIn } from "./coach"

/**
 * Squareness is the one board behaviour no layer below can hold: jsdom
 * computes no layout, so a unit test could only read the class string back.
 */

for (const viewport of [
  { width: 390, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`stays square at ${viewport.width}px, because the board is the hero`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await signIn(page)
    // Straight to the URL: the sidebar is a drawer on a phone, and how a
    // Coach navigates is `nav.spec.ts`'s subject rather than this one's.
    await page.goto("/puzzles/new")

    const box = await page
      .getByRole("group", { name: "Chess board" })
      .boundingBox()

    expect(box).not.toBeNull()
    expect(box!.width).toBeCloseTo(box!.height, 0)
  })
}

test("fills the width its screen allows, so the board is the hero", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  await page.goto("/puzzles/new")

  const box = await page
    .getByRole("group", { name: "Chess board" })
    .boundingBox()

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
  await signIn(page)
  await page.goto("/puzzles/new")
  const board = page.getByRole("group", { name: "Chess board" })

  // a1 is dark and its neighbour is light: parity has an off-by-one each side.
  await expect(square(board, "a1, white rook")).toHaveCSS(
    "background-color",
    "rgb(119, 153, 82)"
  )
  await expect(square(board, "b1, white knight")).toHaveCSS(
    "background-color",
    "rgb(237, 238, 209)"
  )
  await expect(square(board, "a8, black rook")).toHaveCSS(
    "background-color",
    "rgb(237, 238, 209)"
  )
})

test("draws the artwork, so a sighted Student sees the Position too", async ({
  page,
}) => {
  await signIn(page)
  await page.goto("/puzzles/new")
  const board = page.getByRole("group", { name: "Chess board" })
  const pieces = board.locator("img")

  await expect(pieces).toHaveCount(32)
  // Every file resolves. A renamed piece, a missing SVG or a wrong public
  // path draws thirty-two broken images with the whole unit suite green,
  // because the accessible name never touches the filename.
  const loaded = await pieces.evaluateAll((images) =>
    images.every((image) => (image as HTMLImageElement).naturalWidth > 0)
  )
  expect(loaded).toBe(true)

  // And the right piece, not merely a piece: both colours of every file exist.
  await expect(square(board, "a1, white rook").locator("img")).toHaveAttribute(
    "src",
    "/pieces/wR.svg"
  )
  await expect(square(board, "e8, black king").locator("img")).toHaveAttribute(
    "src",
    "/pieces/bK.svg"
  )
})

function square(board: Locator, name: string) {
  return board.getByRole("button", { name, exact: true })
}
