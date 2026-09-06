import { expect, test } from "@playwright/test"
import { Pool } from "pg"

import type { Page } from "@playwright/test"

import { requireEnv } from "../../src/lib/env"
import { boardOf, square, trayOf } from "./board"
import { openNewPuzzle, signIn } from "./coach"

/** Another Coach, written behind the app's back so nothing below this can lie. */
const OTHER_COACH = { id: "e2e-other-owner", email: "owner@e2e.test" }
const THEIR_PUZZLE = "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1"

let pool: Pool

test.beforeAll(() => {
  pool = new Pool({ connectionString: requireEnv("E2E_DATABASE_URL") })
})

test.beforeEach(() => pool.query("delete from puzzle"))

test.afterAll(() => pool.end())

/**
 * The whole of Confirm & Edit, end to end: a Position built by tapping, a
 * Goal, a name, a real row, and the same Puzzle coming back. Nothing below a
 * browser and a database composes those — the screen, the server function,
 * the Coach the session names and the Library that reads it back.
 */
test("a Coach builds a Puzzle by hand and finds it in the Library", async ({
  page,
}) => {
  await openNewPuzzle(page)

  // The validity check is blocking before anything is placed.
  await expect(page.getByText("White has no king.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled()

  await place(page, "white king", "f6")
  await place(page, "black king", "h8")
  await place(page, "white queen", "g1")
  // Black to move: White is not in check, so the Position is legal either
  // way — and asserting it comes back is only worth anything if it is not
  // the default the editor opens on.
  await page.getByRole("radio", { name: "Black", exact: true }).check()

  await expect(
    page.getByText("This position cannot be played yet.")
  ).toBeHidden()

  await page.getByLabel("Name").fill("Queen and king mate")
  await page.getByLabel("Mate in").fill("2")
  await page.getByRole("button", { name: "Save" }).click()

  // Saved means it is in the Library, not that a button went grey.
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible()
  await page.getByRole("link", { name: "Queen and king mate" }).click()

  await expect(page.getByRole("heading", { name: "Edit Puzzle" })).toBeVisible()
  const board = boardOf(page)
  await expect(
    board.getByRole("button", { name: /^h8, black king/ })
  ).toBeVisible()
  await expect(
    board.getByRole("button", { name: /^g1, white queen/ })
  ).toBeVisible()
  await expect(
    board.getByRole("button", { name: /^f6, white king/ })
  ).toBeVisible()
  await expect(
    page.getByRole("radio", { name: "Black", exact: true })
  ).toBeChecked()
  await expect(page.getByLabel("Mate in")).toHaveValue("2")
  await expect(page.getByLabel("Name")).toHaveValue("Queen and king mate")
})

test("a Puzzle id that is nobody's is not found, rather than an error page", async ({
  page,
}) => {
  await signIn(page)

  // A well-formed uuid nothing was ever written under, and a string that is
  // not a uuid at all — postgres raises on the second, so the route has to
  // answer before the query does.
  for (const id of ["00000000-0000-4000-8000-000000000000", "not-a-puzzle"]) {
    await page.goto(`/puzzles/${id}`)
    await expect(page.getByRole("heading", { name: "404" }), id).toBeVisible()
  }
})

test("another Coach's Puzzle is not found, even by its own id", async ({
  page,
}) => {
  await pool.query(
    `insert into "user" (id, name, email) values ($1, 'Other Owner', $2)
     on conflict (id) do nothing`,
    [OTHER_COACH.id, OTHER_COACH.email]
  )
  const { rows } = await pool.query<{ id: string }>(
    `insert into puzzle (coach_id, name, fen, goal_kind, goal_n)
     values ($1, 'Not yours', $2, 'mate_in', 1) returning id`,
    [OTHER_COACH.id, THEIR_PUZZLE]
  )

  await signIn(page)
  await page.goto(`/puzzles/${rows[0].id}`)

  // The id is real and the Puzzle exists — only the Coach is wrong. Without
  // `coach_id` in the `where`, this screen would open someone else's Puzzle.
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible()
  await expect(page.getByLabel("Name")).toBeHidden()
})

/** Choose a piece in the tray, then tap the square it goes on. */
async function place(page: Page, piece: string, coordinate: string) {
  await trayOf(page).getByRole("radio", { name: piece }).click()
  await square(boardOf(page), coordinate).click()
}
