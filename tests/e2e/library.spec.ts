import { expect, test } from "@playwright/test"
import { Pool } from "pg"

import { requireEnv } from "../../src/lib/env"
import { signIn } from "./coach"
import { addPuzzle } from "./puzzle"

import type { Page } from "@playwright/test"

/** Rows written behind the app's back, so nothing below this can lie. */

const OTHER_COACH = { id: "e2e-other-coach", email: "other@e2e.test" }
const MATE_IN_ONE = "7k/5KQ1/8/8/8/8/8/8 w - - 0 1"

let pool: Pool

test.beforeAll(() => {
  pool = new Pool({ connectionString: requireEnv("E2E_DATABASE_URL") })
})

test.beforeEach(() => pool.query("delete from puzzle"))

test.afterAll(() => pool.end())

const rows = (page: Page) =>
  page.getByRole("list", { name: "Puzzles" }).getByRole("listitem")

test("an empty Library says so, rather than showing an empty box", async ({
  page,
}) => {
  await signIn(page)

  await expect(page.getByText("No puzzles yet")).toBeVisible()
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
  await addPuzzle(pool, "Back rank mate", MATE_IN_ONE)
  await addPuzzle(pool, "anastasia's mate", MATE_IN_ONE)
  await addPuzzle(pool, "Someone else's puzzle", MATE_IN_ONE, {
    email: OTHER_COACH.email,
  })

  await signIn(page)

  // The count is its own assertion because `toContainText` asserts none
  // (docs/learnings/testing.md), and it is what keeps the other Coach out.
  await expect(rows(page)).toHaveCount(2)
  await expect(rows(page)).toContainText(["anastasia's mate", "Back rank mate"])
  await expect(page.getByText("No puzzles yet")).toBeHidden()
})

test("says what each Puzzle asks for, so a Coach can scan for one", async ({
  page,
}) => {
  await addPuzzle(pool, "Back rank mate", MATE_IN_ONE, { mateIn: 2 })
  await addPuzzle(pool, "Queen and king", MATE_IN_ONE, { mateIn: 1 })

  await signIn(page)

  // In name order, so each Goal has to land on its own Puzzle's row.
  await expect(rows(page)).toHaveCount(2)
  await expect(rows(page)).toContainText([
    "Checkmate in 2 moves",
    "Checkmate in 1 move",
  ])
})
