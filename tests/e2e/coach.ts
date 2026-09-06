import { E2E_ADMIN } from "../../scripts/e2e-db"
import { hydrated } from "./hydrated"

import type { Page } from "@playwright/test"

/**
 * Signed in and on the Library. Sign-in itself is the subject of
 * `sign-in.spec.ts`; everywhere else it is setup.
 */
export async function signIn(page: Page) {
  await page.goto("/sign-in")
  await hydrated(page, "form")
  await page.getByLabel("Email").fill(E2E_ADMIN.email)
  await page.getByLabel("Password").fill(E2E_ADMIN.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.getByRole("heading", { name: "Library" }).waitFor()
}

/**
 * Signed in and on Confirm & Edit for a new Puzzle, ready to scan or place
 * pieces.
 */
export async function openNewPuzzle(page: Page) {
  await signIn(page)
  // Straight to the URL: the sidebar is a drawer on a phone, and how a
  // Coach navigates is `nav.spec.ts`'s subject rather than this one's.
  await page.goto("/puzzles/new")
  await hydrated(page, "form")
}

/**
 * Signed in, on Confirm & Edit for one saved Puzzle. The Library is the only
 * way to it today, so the link is the route rather than a URL.
 */
export async function openPuzzle(page: Page, name: string) {
  await signIn(page)
  await page.getByRole("link", { name }).click()
  await hydrated(page, "form")
}

/** That Puzzle, opened and then played. */
export async function openInPlay(page: Page, name: string) {
  await openPuzzle(page, name)
  await page.getByRole("button", { name: "Play" }).click()
  await page.getByRole("heading", { name, level: 1 }).waitFor()
}
