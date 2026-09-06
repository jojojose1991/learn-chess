import { expect, test } from "@playwright/test"
import { Pool } from "pg"

import type { Browser, BrowserContext, Page } from "@playwright/test"

import { requireEnv } from "../../src/lib/env"
import { openPuzzle } from "./coach"
import { addPuzzle } from "./puzzle"
import { hydrated } from "./hydrated"

/**
 * A Puzzle Link, from the Coach minting it to a Student opening it in a
 * browser that has never signed in. E2E and nothing lower, because what is on
 * trial is a real slug crossing a real request with no session cookie on it —
 * the service test can fake a repository, but it cannot fail to be signed in.
 *
 * The Student is a second browser context on purpose: the same context would
 * carry the Coach's session and prove nothing about the guard.
 */

/** White plays Qg7 mate; Black is not already in check, so it is legal too. */
const MATE_IN_ONE = "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1"
/** Black to move, one move into the Fool's Mate: ...e5, g4, Qh4#. */
const FOOLS_MATE = "rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1"

const GREEN = "rgb(119, 153, 82)"
const BROWN = "rgb(181, 136, 99)"

let pool: Pool
/** The Students of one test, so a worker does not end holding six browsers. */
let contexts: Array<BrowserContext> = []

test.beforeAll(() => {
  pool = new Pool({ connectionString: requireEnv("E2E_DATABASE_URL") })
})

// `puzzle_link` goes with it: the slug's row is `on delete cascade`.
test.beforeEach(() => pool.query("delete from puzzle"))

test.afterEach(async () => {
  for (const context of contexts) await context.close()
  contexts = []
  // The theme is on the Coach's row and outlives the test that changed it, so
  // a failure between the two clicks below would leave every later spec on
  // brown. `workers: 1` over one clone means that is the whole run.
  await pool.query(`update "user" set board_theme = 'green'`)
})

test.afterAll(() => pool.end())

const boardOf = (page: Page) => page.getByRole("group", { name: "Chess board" })

/** Mints the link if there is none yet, and answers with the URL to send. */
async function mint(page: Page) {
  const create = page.getByRole("button", { name: "Create link" })
  if (await create.isVisible()) await create.click()
  const url = page.getByRole("textbox", { name: "Puzzle Link" })
  await expect(url).toBeVisible()
  return url.inputValue()
}

/** A browser with no session at all, which is what a Student arrives in. */
async function asStudent(browser: Browser, url: string) {
  const context = await browser.newContext()
  contexts.push(context)
  const page = await context.newPage()
  await page.goto(url)
  return page
}

/**
 * Waits for the board to be live. Playwright's actionability checks do not
 * imply hydrated, and a tap on inert HTML is silently dropped — and this page
 * has no `<form>` to wait on the way every other spec does.
 */
const boardLive = (page: Page) =>
  hydrated(page, '[aria-label="Chess board"] button')

test("opens straight on Play in a browser that has never signed in", async ({
  page,
  browser,
}) => {
  await addPuzzle(pool, "Queen and king mate", MATE_IN_ONE)
  await openPuzzle(page, "Queen and king mate")

  const url = await mint(page)
  expect(url).toMatch(/\/p\/[0234-9a-hjkmnp-z]{8}$/)

  const student = await asStudent(browser, url)

  // Play, at the Position it was stored with — and not the sign-in screen.
  await expect(
    student.getByRole("heading", { name: "Queen and king mate", level: 1 })
  ).toBeVisible()
  await expect(
    boardOf(student).getByRole("button", { name: "g1, white queen" })
  ).toBeVisible()
  await expect(student.getByText("Checkmate in 1 move")).toBeVisible()

  // No sign-in, no Library, no navigation, and no way to edit the Position:
  // the Student's screen is the board and the controls on it.
  await expect(student.getByRole("link", { name: /sign in/i })).toHaveCount(0)
  await expect(student.getByRole("link", { name: "Library" })).toHaveCount(0)
  await expect(
    student.getByRole("button", { name: "Toggle Sidebar" })
  ).toHaveCount(0)

  // And it is a board, not a picture of one: the Student can solve it.
  await boardLive(student)
  await boardOf(student)
    .getByRole("button", { name: "g1, white queen" })
    .click()
  await boardOf(student)
    .getByRole("button", { name: /^g7(,|$)/ })
    .click()
  await expect(student.getByText("Solved!")).toBeVisible()
})

test("plays on the board it was stamped with, not on the one the Coach moved to", async ({
  page,
  browser,
}) => {
  await addPuzzle(pool, "Queen and king mate", MATE_IN_ONE)
  await openPuzzle(page, "Queen and king mate")
  const themes = page.getByRole("group", { name: "Board theme" })
  await hydrated(page, '[aria-label="Board theme"] button')

  // Minted while the Coach teaches on brown.
  await themes.getByRole("button", { name: /brown/i }).click()
  await expect(
    boardOf(page).getByRole("button", { name: "a1, empty", exact: true })
  ).toHaveCSS("background-color", BROWN)
  const url = await mint(page)

  // The Coach moves back to green — which is also what the rest of the suite
  // expects to find. The link a Student already holds is not repainted.
  await themes.getByRole("button", { name: /green/i }).click()
  await expect(
    boardOf(page).getByRole("button", { name: "a1, empty", exact: true })
  ).toHaveCSS("background-color", GREEN)

  const student = await asStudent(browser, url)

  await expect(
    boardOf(student).getByRole("button", { name: "a1, empty", exact: true })
  ).toHaveCSS("background-color", BROWN)
})

test("opens the Puzzle its own slug points at, and not whichever was read first", async ({
  page,
  browser,
}) => {
  await addPuzzle(pool, "Queen and king mate", MATE_IN_ONE)
  await addPuzzle(pool, "Fool's mate", FOOLS_MATE)

  await openPuzzle(page, "Queen and king mate")
  const queen = await mint(page)
  await page.goto("/")
  await page.getByRole("link", { name: "Fool's mate" }).click()
  await hydrated(page, "form")
  const fools = await mint(page)

  expect(fools).not.toBe(queen)

  const first = await asStudent(browser, queen)
  await expect(
    first.getByRole("heading", { name: "Queen and king mate", level: 1 })
  ).toBeVisible()

  const second = await asStudent(browser, fools)
  await expect(
    second.getByRole("heading", { name: "Fool's mate", level: 1 })
  ).toBeVisible()
  await expect(
    boardOf(second).getByRole("button", { name: "f3, white pawn" })
  ).toBeVisible()
})

test("refuses a revoked link in the same words an unknown one gets", async ({
  page,
  browser,
}) => {
  await addPuzzle(pool, "Queen and king mate", MATE_IN_ONE)
  await openPuzzle(page, "Queen and king mate")
  const url = await mint(page)

  await page.getByRole("button", { name: "Revoke link" }).click()
  await expect(page.getByRole("button", { name: "Create link" })).toBeVisible()

  const student = await asStudent(browser, url)
  const refusal = student.getByRole("heading", { level: 1 })
  await expect(refusal).toHaveText("This link is closed")

  // A slug nobody ever minted is refused in the same words, so neither answer
  // tells a stranger which Puzzles exist.
  const unknown = new URL(url)
  unknown.pathname = "/p/zzzzzzzz"
  await student.goto(unknown.toString())
  await expect(refusal).toHaveText("This link is closed")
  // Nothing to sign into, and nothing to go on to: a dead end on purpose.
  await expect(student.getByRole("main").getByRole("link")).toHaveCount(0)
})

test("needs no sideways scrolling on a phone, which is where a Student meets it", async ({
  page,
  browser,
}) => {
  // The longest name `NAME_MAX` allows, in one unbroken word — which is what
  // a heading with nothing wrapping it pushes off the side of a phone.
  const name = "m".repeat(100)
  await addPuzzle(pool, name, MATE_IN_ONE)
  await openPuzzle(page, name)
  const url = await mint(page)

  const student = await asStudent(browser, url)
  await student.setViewportSize({ width: 390, height: 800 })
  await expect(student.getByRole("heading", { name, level: 1 })).toBeVisible()

  const overflow = await student.evaluate(() => {
    const doc = document.scrollingElement!
    return Math.max(0, doc.scrollWidth - doc.clientWidth)
  })
  expect(overflow).toBe(0)
})
