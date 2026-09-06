import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"

import type { Page } from "@playwright/test"

import { KEYSTONE, outBy } from "../fixtures/keystone"
import { boardOf } from "./board"
import { openNewPuzzle } from "./coach"

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
  const board = boardOf(page)
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
  await openNewPuzzle(page)

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
  await openNewPuzzle(page)

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
  const board = boardOf(page)
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
  await openNewPuzzle(page)

  await page
    .getByLabel("Scan an image of a board")
    .setInputFiles(image("board-askew"))

  await expect(page.getByRole("alert")).toContainText("did not read cleanly")
  // The board is still the empty one a Coach starts from, and the Position
  // that cannot be played is still refused.
  await expect(
    boardOf(page).getByRole("button", { name: /, empty$/ })
  ).toHaveCount(64)
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled()
})

test("a file that is not an image is refused at the route, not by the browser", async ({
  page,
}) => {
  await openNewPuzzle(page)

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
    await openNewPuzzle(page)

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

/**
 * The recovery path. `board-keystone.jpg` is the board seen from off to one
 * side, which the detector cannot find at all — the same script writes the
 * four corners it landed on, so a test can put the handles exactly where a
 * careful Coach would.
 *
 * What this cannot measure is a finger. It proves the plumbing at each width
 * and that accurate corners read the board; whether a five-year-old's parent
 * can hit ±8 image pixels with a thumb is a thing to watch someone do.
 */
const HANDLES = ["Top left", "Top right", "Bottom right", "Bottom left"]

/** Drag each handle onto the point it belongs on, in the picture's own pixels. */
async function putCornersOn(
  page: Page,
  corners: Array<{ x: number; y: number }>
) {
  const picture = page.getByRole("img", { name: /handle on each corner/ })
  // `boundingBox` does not scroll, and `page.mouse` is a raw dispatch with no
  // actionability check — a handle below the fold would be quietly missed and
  // leave a wrong read rather than an error.
  await picture.scrollIntoViewIfNeeded()
  const box = await picture.boundingBox()
  if (!box) throw new Error("the picture is not on the screen")

  for (const [index, name] of HANDLES.entries()) {
    const handle = page.getByRole("button", {
      name: new RegExp(`^${name} corner`),
    })
    const from = await handle.boundingBox()
    if (!from) throw new Error(`no ${name} handle`)

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      box.x + (corners[index].x / KEYSTONE.width) * box.width,
      box.y + (corners[index].y / KEYSTONE.height) * box.height,
      { steps: 8 }
    )
    await page.mouse.up()
  }
}

const keystone = () => ({
  name: "board-keystone.jpg",
  mimeType: "image/jpeg",
  buffer: readFileSync(
    new URL("../fixtures/board-keystone.jpg", import.meta.url)
  ),
})

test("a board the Scan cannot read offers four corners instead of a dead end", async ({
  page,
}) => {
  await openNewPuzzle(page)

  await page.getByLabel("Scan an image of a board").setInputFiles(keystone())

  // Refused, and in the same breath told what to do about it.
  await expect(page.getByRole("alert")).toContainText("did not read cleanly")
  await expect(
    page.getByRole("button", { name: /^Top left corner/ })
  ).toBeVisible()

  await putCornersOn(page, KEYSTONE.corners)
  await page.getByRole("button", { name: "Read these corners" }).click()

  // The same draft any other Scan opens, in Confirm & Edit, and saveable.
  await expectTheReadPosition(page)
  await expect(page.getByRole("alert")).toBeHidden()

  await page.getByLabel("Name").fill("Scanned from a photo")
  await page.getByLabel("Mate in").fill("2")
  await page.getByRole("button", { name: "Save" }).click()

  await expect(
    page.getByRole("link", { name: "Scanned from a photo" })
  ).toBeVisible()
})

test("corners in the wrong place say so, and moving them reads the board again", async ({
  page,
}) => {
  await openNewPuzzle(page)
  await page.getByLabel("Scan an image of a board").setInputFiles(keystone())

  // 25px out on both axes at every corner: measured, that is 0.24 minimum
  // confidence, and the read stops being one anybody should trust.
  await putCornersOn(page, outBy(25))
  await page.getByRole("button", { name: "Read these corners" }).click()

  await expect(page.getByRole("status")).toContainText("may be off")

  // The Scan is not started over: the same picture, the same handles, moved.
  await putCornersOn(page, KEYSTONE.corners)
  await page.getByRole("button", { name: "Read these corners" }).click()

  // The position first: `scanImage` empties the warning before it fetches, so
  // an empty region on its own would pass against a read that never returned.
  await expectTheReadPosition(page)
  await expect(page.getByRole("status")).toBeEmpty()
})

test("the four corners can be placed on a 390px phone, which is the width that matters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await openNewPuzzle(page)
  await page.getByLabel("Scan an image of a board").setInputFiles(keystone())

  await putCornersOn(page, KEYSTONE.corners)
  await page.getByRole("button", { name: "Read these corners" }).click()

  await expectTheReadPosition(page)
  expect(
    await page.evaluate(() => {
      const doc = document.scrollingElement!
      return Math.max(0, doc.scrollWidth - doc.clientWidth)
    })
  ).toBe(0)
})
