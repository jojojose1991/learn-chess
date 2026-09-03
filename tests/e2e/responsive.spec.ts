import { expect, test } from "@playwright/test"

import { signIn } from "./coach"

import type { Page } from "@playwright/test"

/**
 * One layout that bends (`docs/PLAN.md`): every screen is used at a phone, a
 * tablet and a desktop width, and none of them needs sideways scrolling to be
 * used. Only a real browser can hold this — jsdom computes no layout, so a
 * unit test could assert nothing but the class string it was given.
 *
 * Widths are looped inside one test rather than declared as Playwright
 * projects: `workers: 1` over one shared database clone, so a project per
 * width would re-run sign-in and every other spec three times to check this.
 */

const WIDTHS = [390, 820, 1280]

/** Every screen a person can open today, by the heading that proves it drew. */
const SIGNED_OUT = { path: "/sign-in", heading: "Sign in" }
const SIGNED_IN = [
  { path: "/", heading: "Library" },
  { path: "/puzzles/new", heading: "New Puzzle" },
  { path: "/admin", heading: "Accounts" },
  { path: "/credits", heading: "Credits" },
]

for (const width of WIDTHS) {
  test(`no screen scrolls sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })

    await page.goto(SIGNED_OUT.path)
    expect(
      await overflow(page, SIGNED_OUT.heading),
      `${SIGNED_OUT.path} at ${width}px`
    ).toBe(0)

    await signIn(page)
    for (const screen of SIGNED_IN) {
      await page.goto(screen.path)
      expect(
        await overflow(page, screen.heading),
        `${screen.path} at ${width}px`
      ).toBe(0)
    }
  })
}

/**
 * How far past the viewport the document reaches, in pixels. A positive number
 * is a horizontal scrollbar, which on a phone is something to be dragged
 * before the screen can be read.
 */
async function overflow(page: Page, heading: string) {
  // The heading first: `goto` resolves before the layout it describes exists,
  // and a document that is still empty overflows nothing.
  await expect(
    page.getByRole("heading", { name: heading, level: 1 })
  ).toBeVisible()
  return page.evaluate(() => {
    const doc = document.scrollingElement!
    return Math.max(0, doc.scrollWidth - doc.clientWidth)
  })
}
