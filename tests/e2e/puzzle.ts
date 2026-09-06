import { E2E_ADMIN } from "../../scripts/e2e-db"

import type { Pool } from "pg"

/**
 * A Puzzle written straight into the database, so a test that is about
 * playing one does not spend its first half building it through the editor.
 * Inserted against the Coach's row rather than an id, because the seed owns
 * the id and this only knows the email it seeded.
 */
export async function addPuzzle(
  pool: Pool,
  name: string,
  fen: string,
  { mateIn = 1, email = E2E_ADMIN.email } = {}
) {
  await pool.query(
    `insert into puzzle (coach_id, name, fen, goal_kind, goal_n)
     select id, $2, $3, 'mate_in', $4 from "user" where email = $1`,
    [email, name, fen, mateIn]
  )
}
