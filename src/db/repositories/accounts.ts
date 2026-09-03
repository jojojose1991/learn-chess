import { count, eq } from "drizzle-orm"

import { withDb } from "@/db"
import { puzzle, user } from "@/db/schema"

/**
 * Every Coach with how many Puzzles they own, by email.
 *
 * Rows as the database has them — `banned`, not `revoked`. Naming them the way
 * the product does is the service's job, so the column can be renamed on one
 * side without moving to the other.
 *
 * This is our own query because the admin plugin's `listUsers` cannot count
 * Puzzles. Every write on this table is still the plugin's.
 */
export function listCoachesWithPuzzleCounts() {
  return withDb((db) =>
    db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        banned: user.banned,
        puzzles: count(puzzle.id),
      })
      .from(user)
      .leftJoin(puzzle, eq(puzzle.coachId, user.id))
      .groupBy(user.id)
      .orderBy(user.email)
  )
}
