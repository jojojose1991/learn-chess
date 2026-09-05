import { expect, test } from "@playwright/test"
import { Pool } from "pg"

import type { Locator, Page } from "@playwright/test"

import { E2E_ADMIN } from "../../scripts/e2e-db"
import { requireEnv } from "../../src/lib/env"
import { signIn } from "./coach"
import { hydrated } from "./hydrated"

/**
 * The defender and Hint, against the real Stockfish over the real route.
 *
 * Everything about the loop — the budget, Rewind taking back the pair, a reply
 * to a Position that has moved on — is a reducer and is tested as one
 * (`tests/lib/chess/play.test.ts`); what the screen does with a reply is
 * `tests/components/play-puzzle.test.tsx`, which is handed the answer rather
 * than fetching it. Only here is the answer a real engine's, arriving over
 * HTTP into a real browser, which is the one claim nothing below can make.
 */

/**
 * Black to move, one move into the Fool's Mate. Nothing here is trying to
 * reach that mate — a full-strength defender never walks into it — only to be
 * a Position with a legal move for each side and an attempt that stays open.
 */
const OPEN_POSITION =
  "rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1"

let pool: Pool

/**
 * The engine is a binary the container has and a laptop may not, so this file
 * skips where `pnpm test`'s own engine test skips rather than failing for a
 * reason that is not the code's. The runner's own environment stands in for
 * the server's: same machine, same `.env`, and nothing yet injects one
 * separately.
 */
test.beforeAll(() => {
  try {
    requireEnv("STOCKFISH_PATH")
  } catch {
    test.skip(true, "no STOCKFISH_PATH: there is no engine to defend with")
  }
  pool = new Pool({ connectionString: requireEnv("E2E_DATABASE_URL") })
})

test.beforeEach(() => pool.query("delete from puzzle"))

test.afterAll(() => pool?.end())

/** A Puzzle with two of the Student's moves to spend, so a reply is not the end. */
async function addMateInTwo(name: string, fen: string) {
  await pool.query(
    `insert into puzzle (coach_id, name, fen, goal_kind, goal_n)
     select id, $2, $3, 'mate_in', 2 from "user" where email = $1`,
    [E2E_ADMIN.email, name, fen]
  )
}

const boardOf = (page: Page) => page.getByRole("group", { name: "Chess board" })
const movesOf = (page: Page) => page.getByRole("list", { name: "Moves" })

const square = (board: Locator, name: string) =>
  board.getByRole("button", { name: new RegExp(`^${name}(,|$)`) })

/** Library → the Puzzle → Play, which is the only way in today. */
async function openInPlay(page: Page, name: string) {
  await signIn(page)
  await page.getByRole("link", { name }).click()
  await hydrated(page, "form")
  await page.getByRole("button", { name: "Play" }).click()
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible()
}

test("answers the Student's move with one of its own, and hands the turn back", async ({
  page,
}) => {
  await addMateInTwo("Two moves to spend", OPEN_POSITION)
  await openInPlay(page, "Two moves to spend")
  const board = boardOf(page)

  await square(board, "e7, black pawn").click()
  await square(board, "e5, empty").click()

  // Two plies in the line and only one of them the Student's: the second is
  // whatever Stockfish chose, which is why nothing here names it. The wait is
  // the engine's own budget plus a possible cold start — a spawn and a
  // handshake before it has thought about anything at all.
  await expect(movesOf(page).getByRole("listitem")).toHaveCount(2, {
    timeout: 15_000,
  })
  const [played] = await movesOf(page).getByRole("listitem").allTextContents()
  expect(played).toBe("e5")

  // Back to the Student, with the budget still holding a second move — a reply
  // that cost one would have ended the attempt here.
  await expect(page.getByText("Black to move")).toBeVisible()
  await expect(page.getByText("Not this time")).toBeHidden()
})

test("hints one piece and nothing else — no destination, no arrow, no notation", async ({
  page,
}) => {
  await addMateInTwo("Two moves to spend", OPEN_POSITION)
  await openInPlay(page, "Two moves to spend")
  const board = boardOf(page)

  await page.getByRole("button", { name: "Hint" }).click()

  // Exactly one square says so, and it holds a piece of the Student's own.
  const hinted = board.getByRole("button", { name: /, try this piece$/ })
  await expect(hinted).toHaveCount(1, { timeout: 15_000 })
  await expect(hinted).toHaveAccessibleName(/black/)
  // The move itself is never shown: no square is marked as somewhere to go.
  await expect(
    board.getByRole("button", { name: /, can move here$/ })
  ).toHaveCount(0)
  await expect(movesOf(page).getByRole("listitem")).toHaveCount(0)
})
