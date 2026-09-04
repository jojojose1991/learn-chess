import { expect, test } from "@playwright/test"

import type { Page } from "@playwright/test"

import { signIn } from "./coach"
import { hydrated } from "./hydrated"

/**
 * The board a Coach teaches on. Ticket 06 asserted green and left brown owed,
 * because nothing in the product could select it; this is that assertion, and
 * the two hex pairs are `docs/PLAN.md`'s own product decision.
 *
 * E2E and not lower: a unit test in jsdom computes no styles, so it could only
 * read back the class name it just passed in — and the choice surviving a
 * sign-out is a real column read by a real session, which is the whole point
 * of storing it on the Coach rather than in the browser.
 */
const GREEN = { dark: "rgb(119, 153, 82)", light: "rgb(237, 238, 209)" }
const BROWN = { dark: "rgb(181, 136, 99)", light: "rgb(240, 217, 181)" }

test("repaints the board the Coach is looking at, in the theme they picked", async ({
  page,
}) => {
  await signIn(page)
  await newPuzzle(page)

  await choose(page, /brown/i)

  await expectBoard(page, BROWN)
  // The chrome says which board is in force, so a Coach is never guessing.
  await expect(
    themes(page).getByRole("button", { name: /brown/i })
  ).toHaveAttribute("aria-pressed", "true")

  // Back again: the choice is a toggle, not a one-way door — and it leaves
  // the Coach on the default the rest of the suite expects.
  await choose(page, /green/i)

  await expectBoard(page, GREEN)
})

test("stays chosen after signing out, because the board belongs to the Coach", async ({
  page,
}) => {
  await signIn(page)
  await newPuzzle(page)
  await choose(page, /brown/i)
  // Before signing out, because the click only dispatches the write: a
  // sign-out that overtook it would end the session the write needs, and the
  // test would fail on the very thing it is here to prove.
  await expectBoard(page, BROWN)

  await page.getByRole("button", { name: "Sign out" }).click()
  await page.getByRole("heading", { name: "Sign in" }).waitFor()
  await signIn(page)
  await newPuzzle(page)

  await expectBoard(page, BROWN)

  await choose(page, /green/i)
  await expectBoard(page, GREEN)
})

/**
 * On the screen with a board, with the toggle live. Playwright's actionability
 * checks do not imply hydrated, and a click on inert HTML does nothing at all
 * — the theme buttons have no non-JS fallback to fall back to.
 */
async function newPuzzle(page: Page) {
  await page.goto("/puzzles/new")
  await hydrated(page, '[aria-label="Board theme"] button')
}

/** The board theme controls, which live in the sidebar and never on a screen. */
function themes(page: Page) {
  return page.getByRole("group", { name: "Board theme" })
}

async function choose(page: Page, theme: RegExp) {
  await themes(page).getByRole("button", { name: theme }).click()
}

/**
 * a1 is dark and its neighbour is light, so a palette applied to the wrong
 * squares fails here as loudly as no palette at all. Both are empty: Confirm
 * & Edit starts from an empty board, and the square's colour is the subject
 * here rather than what stands on it.
 */
async function expectBoard(
  page: Page,
  palette: { dark: string; light: string }
) {
  const board = page.getByRole("group", { name: "Chess board" })

  await expect(
    board.getByRole("button", { name: "a1, empty", exact: true })
  ).toHaveCSS("background-color", palette.dark)
  await expect(
    board.getByRole("button", { name: "b1, empty", exact: true })
  ).toHaveCSS("background-color", palette.light)
}
