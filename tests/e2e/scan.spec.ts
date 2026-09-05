import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"

import type { Page } from "@playwright/test"

import { signIn } from "./coach"
import { hydrated } from "./hydrated"

/**
 * The other way into a Puzzle, end to end. Nothing below a browser composes
 * it: a real file leaving a real file input, a real image crossing the route,
 * the classifier reading it and the draft opening in Confirm & Edit.
 *
 * The fixtures are screenshots of a board taken by a browser —
 * `pnpm tsx scripts/scan-fixture.ts` remakes them.
 */

const image = (name: string) => ({
  name: `${name}.png`,
  mimeType: "image/png",
  buffer: readFileSync(new URL(`../fixtures/${name}.png`, import.meta.url)),
})

/** Four squares of the fixture's position, enough that no other read passes. */
async function expectTheReadPosition(page: Page) {
  const board = page.getByRole("group", { name: "Chess board" })
  for (const square of [
    "c4, white bishop",
    "f3, white queen",
    "e5, black pawn",
    "f6, black knight",
  ]) {
    await expect(board.getByRole("button", { name: square })).toBeVisible()
  }
}

test("a Coach scans a screenshot and confirms the Position it read", async ({
  page,
}) => {
  await signIn(page)
  await page.goto("/puzzles/new")
  await hydrated(page, "form")

  await page
    .getByLabel("Scan an image of a board")
    .setInputFiles(image("board-white"))

  await expectTheReadPosition(page)
  // Read from White's side, so the control the suggestion pre-set says so and
  // the draft is the placement as it stands.
  await expect(page.getByRole("radio", { name: "White's side" })).toBeChecked()

  // A draft is a Puzzle only once a person has confirmed it.
  await page.getByLabel("Name").fill("Scanned opening")
  await page.getByLabel("Mate in").fill("2")
  await page.getByRole("button", { name: "Save" }).click()

  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Scanned opening" })
  ).toBeVisible()
})

test("a board screenshotted from Black's side opens the right way up, with the control that turned it", async ({
  page,
}) => {
  await signIn(page)
  await page.goto("/puzzles/new")
  await hydrated(page, "form")

  await page
    .getByLabel("Scan an image of a board")
    .setInputFiles(image("board-black"))

  // The classifier read this mirrored; the suggestion pre-set the control and
  // the control turned it round, so the Coach can see both what happened and
  // how to undo it.
  await expect(page.getByRole("radio", { name: "Black's side" })).toBeChecked()
  await expectTheReadPosition(page)

  await page.getByRole("radio", { name: "White's side" }).check()

  // Turning it back gives the mirror again — the Coach's own call either way.
  const board = page.getByRole("group", { name: "Chess board" })
  await expect(
    board.getByRole("button", { name: "f5, white bishop" })
  ).toBeVisible()
  await expect(
    board.getByRole("button", { name: "c6, white queen" })
  ).toBeVisible()
})

test("an image that did not read cleanly says so instead of opening a draft", async ({
  page,
}) => {
  await signIn(page)
  await page.goto("/puzzles/new")
  await hydrated(page, "form")

  await page
    .getByLabel("Scan an image of a board")
    .setInputFiles(image("board-askew"))

  await expect(page.getByRole("alert")).toContainText("did not read cleanly")
  // The board is still the empty one a Coach starts from, and the Position
  // that cannot be played is still refused.
  await expect(
    page
      .getByRole("group", { name: "Chess board" })
      .getByRole("button", { name: /, empty$/ })
  ).toHaveCount(64)
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled()
})

test("a file that is not an image is refused at the route, not by the browser", async ({
  page,
}) => {
  await signIn(page)
  await page.goto("/puzzles/new")
  await hydrated(page, "form")

  await page.getByLabel("Scan an image of a board").setInputFiles({
    name: "not-a-board.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("#!/bin/sh\nrm -rf /\n"),
  })

  await expect(page.getByRole("alert")).toContainText(
    "not a PNG or a JPEG image"
  )
})

/**
 * `responsive.spec.ts` walks every screen at these three widths, but it walks
 * them empty. A scanned draft is what New Puzzle actually looks like once it
 * has been used: a file input, a fieldset of radios and a board, all at once.
 */
for (const width of [390, 820, 1280]) {
  test(`a scanned draft needs no sideways scrolling at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await signIn(page)
    await page.goto("/puzzles/new")
    await hydrated(page, "form")

    await page
      .getByLabel("Scan an image of a board")
      .setInputFiles(image("board-white"))
    await expectTheReadPosition(page)
    await expect(
      page.getByRole("radio", { name: "White's side" })
    ).toBeChecked()

    expect(
      await page.evaluate(() => {
        const doc = document.scrollingElement!
        return Math.max(0, doc.scrollWidth - doc.clientWidth)
      })
    ).toBe(0)
  })
}
