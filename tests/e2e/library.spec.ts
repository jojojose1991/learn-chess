import { expect, test } from "@playwright/test"
import { Pool } from "pg"

import { E2E_ADMIN } from "../../scripts/e2e-db"
import { requireEnv } from "../../src/lib/env"
import { signIn } from "./coach"

/** Rows written behind the app's back, so nothing below this can lie. */

const OTHER_COACH = { id: "e2e-other-coach", email: "other@e2e.test" }
const MATE_IN_ONE = "7k/5KQ1/8/8/8/8/8/8 w - - 0 1"

let pool: Pool

test.beforeAll(() => {
  pool = new Pool({ connectionString: requireEnv("E2E_DATABASE_URL") })
})

test.beforeEach(() => pool.query("delete from puzzle"))

test.afterAll(() => pool.end())

async function addPuzzle(email: string, name: string) {
  await pool.query(
    `insert into puzzle (coach_id, name, fen, goal_kind, goal_n)
     select id, $2, $3, 'mate_in', 1 from "user" where email = $1`,
    [email, name, MATE_IN_ONE]
  )
}

test("an empty Library says so, rather than showing an empty box", async ({
  page,
}) => {
  await signIn(page)

  await expect(page.getByText("No puzzles yet")).toBeVisible()
  await expect(page.getByRole("link", { name: "New Puzzle" })).toBeVisible()
})

test("lists the Coach's own Puzzles by name, and never another Coach's", async ({
  page,
}) => {
  await pool.query(
    `insert into "user" (id, name, email) values ($1, 'Other Coach', $2)`,
    [OTHER_COACH.id, OTHER_COACH.email]
  )
  // A capital B sorts before a lower-case a by byte, so this order comes out
  // right only if the sort ignores case.
  await addPuzzle(E2E_ADMIN.email, "Back rank mate")
  await addPuzzle(E2E_ADMIN.email, "anastasia's mate")
  await addPuzzle(OTHER_COACH.email, "Someone else's puzzle")

  await signIn(page)

  await expect(
    page.getByRole("list", { name: "Puzzles" }).getByRole("listitem")
  ).toHaveText(["anastasia's mate", "Back rank mate"])
  await expect(page.getByText("No puzzles yet")).toBeHidden()
})

test("New Puzzle opens the New Puzzle screen", async ({ page }) => {
  await signIn(page)

  await page.getByRole("link", { name: "New Puzzle" }).click()

  await expect(page.getByRole("heading", { name: "New Puzzle" })).toBeVisible()
})
