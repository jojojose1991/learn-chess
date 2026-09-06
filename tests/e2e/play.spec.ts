import { expect, test } from "@playwright/test"
import { Pool } from "pg"

import type { Locator, Page } from "@playwright/test"

import { requireEnv } from "../../src/lib/env"
import { openInPlay } from "./coach"
import { addPuzzle } from "./puzzle"

/**
 * Play, end to end. The loop itself is a reducer and is tested as one
 * (`tests/lib/chess/play.test.ts`); what is here is only what nothing below a
 * browser can hold — the layout the board and the move list share, the
 * promotion picker's `showModal`, and a real Puzzle read back out of postgres
 * at the Position it was stored with.
 */

/** White plays Qg7 mate; Black is not already in check, so it is legal too. */
const MATE_IN_ONE = "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1"
/** A white pawn one square from the last rank, and a king each. */
const PROMOTING = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1"

let pool: Pool

test.beforeAll(() => {
  pool = new Pool({ connectionString: requireEnv("E2E_DATABASE_URL") })
})

test.beforeEach(() => pool.query("delete from puzzle"))

test.afterAll(() => pool.end())

const boardOf = (page: Page) => page.getByRole("group", { name: "Chess board" })
const movesOf = (page: Page) => page.getByRole("list", { name: "Moves" })

const square = (board: Locator, name: string) =>
  board.getByRole("button", { name: new RegExp(`^${name}(,|$)`) })

test("a Coach opens a saved Puzzle and plays it at the Position it was stored with", async ({
  page,
}) => {
  await addPuzzle(pool, "Queen and king mate", MATE_IN_ONE)

  await openInPlay(page, "Queen and king mate")
  const board = boardOf(page)

  // The stored Position, read back through the server and the loader.
  await expect(square(board, "g1, white queen")).toBeVisible()
  await expect(page.getByText("Checkmate in 1 move")).toBeVisible()
  await expect(page.getByText("White to move")).toBeVisible()

  // An illegal attempt is refused with its reason, and the king stays put.
  await square(board, "f6, white king").click()
  await square(board, "h6, empty").click()
  await expect(page.getByRole("alert")).toHaveText(
    "A king moves one square at a time, in any direction."
  )
  await expect(square(board, "f6, white king")).toBeVisible()

  // A legal one is played, and the line says so.
  await square(board, "g1, white queen").click()
  await square(board, "g7, empty").click()
  await expect(movesOf(page).getByRole("listitem")).toHaveText(["Qg7#"])
  await expect(page.getByRole("alert")).toBeHidden()

  await page.getByRole("button", { name: "Reset" }).click()
  await expect(movesOf(page).getByRole("listitem")).toHaveCount(0)
  await expect(square(board, "g1, white queen")).toBeVisible()
})

test("keeps Try again tappable at all three widths, with no sideways scrolling", async ({
  page,
}) => {
  await addPuzzle(pool, "Queen and king mate", MATE_IN_ONE)
  await openInPlay(page, "Queen and king mate")
  const board = boardOf(page)

  // Qg8+ is legal and it is check, but it is not mate — so the one move this
  // Goal allowed is spent and the attempt is over.
  await square(board, "g1, white queen").click()
  await square(board, "g8, empty").click()

  // What the banner says, and that Try again starts the Puzzle over, are
  // `tests/components/play-puzzle.test.tsx`. Only a browser can measure the
  // 44px a five-year-old's finger needs, and that the banner pushes nothing
  // sideways at any of the three widths (docs/PLAN.md).
  const again = page.getByRole("button", { name: "Try again" })
  await expect(again).toBeVisible()

  for (const width of [390, 820, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    const box = await again.boundingBox()
    expect(box!.width, `Try again at ${width}px`).toBeGreaterThanOrEqual(44)
    expect(box!.height, `Try again at ${width}px`).toBeGreaterThanOrEqual(44)
    expect(await overflow(page), `${width}px`).toBe(0)
  }
})

test("keeps the board its full size beside the move list, and puts the list beneath it on a phone", async ({
  page,
}) => {
  await addPuzzle(pool, "Queen and king mate", MATE_IN_ONE)
  await openInPlay(page, "Queen and king mate")

  await page.setViewportSize({ width: 1280, height: 800 })
  const wide = await boxes(page)

  // The board is the hero and the list gives way to it, not the other way
  // round: sharing the width evenly would put the board near 480.
  expect(wide.board.width).toBeGreaterThanOrEqual(500)
  expect(wide.moves.x).toBeGreaterThanOrEqual(wide.board.x + wide.board.width)

  await page.setViewportSize({ width: 390, height: 800 })
  const narrow = await boxes(page)

  expect(narrow.moves.y).toBeGreaterThanOrEqual(
    narrow.board.y + narrow.board.height
  )
  // The strip scrolls sideways so the screen does not.
  expect(await overflow(page)).toBe(0)
})

test("asks a promoting pawn what it becomes, in buttons a five-year-old can hit", async ({
  page,
}) => {
  await addPuzzle(pool, "Promote", PROMOTING)
  await openInPlay(page, "Promote")
  const board = boardOf(page)

  await square(board, "a7, white pawn").click()
  await square(board, "a8, empty").click()

  // `showModal`, which jsdom does not implement: the picker is on the top
  // layer and the board behind it cannot be tapped through.
  const picker = page.getByRole("dialog", { name: "Promote to" })
  await expect(picker).toBeVisible()
  const choices = picker.getByRole("button")
  await expect(choices).toHaveCount(4)

  // Queen first and biggest, and none of them under the 44px a five-year-old
  // needs — all three are sizes, which only a browser can measure.
  let previous = Infinity
  for (const [index, name] of ["Queen", "Rook", "Bishop", "Knight"].entries()) {
    const choice = choices.nth(index)
    await expect(choice).toHaveAccessibleName(name)
    const box = await choice.boundingBox()
    expect(box!.width, name).toBeGreaterThanOrEqual(44)
    expect(box!.height, name).toBeGreaterThanOrEqual(44)
    expect(box!.width, name).toBeLessThanOrEqual(previous)
    previous = box!.width
  }

  await picker.getByRole("button", { name: "Rook" }).click()

  await expect(picker).toBeHidden()
  await expect(movesOf(page).getByRole("listitem")).toHaveText(["a8=R+"])
})

test("plays on the board the Coach teaches on, not on the default", async ({
  page,
}) => {
  await addPuzzle(pool, "Queen and king mate", MATE_IN_ONE)
  await openInPlay(page, "Queen and king mate")
  const themes = page.getByRole("group", { name: "Board theme" })

  await themes.getByRole("button", { name: /brown/i }).click()

  await expect(square(boardOf(page), "a1, empty")).toHaveCSS(
    "background-color",
    "rgb(181, 136, 99)"
  )

  // Back to the default the rest of the suite plays on.
  await themes.getByRole("button", { name: /green/i }).click()
  await expect(square(boardOf(page), "a1, empty")).toHaveCSS(
    "background-color",
    "rgb(119, 153, 82)"
  )
})

/** Where the board and the move list actually are, once the layout settled. */
async function boxes(page: Page) {
  const board = await boardOf(page).boundingBox()
  const moves = await movesOf(page).boundingBox()
  expect(board).not.toBeNull()
  expect(moves).not.toBeNull()
  return { board: board!, moves: moves! }
}

/** How far past the viewport the document reaches — a sideways scrollbar. */
function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.scrollingElement!
    return Math.max(0, doc.scrollWidth - doc.clientWidth)
  })
}
