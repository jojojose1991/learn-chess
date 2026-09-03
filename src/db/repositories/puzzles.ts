import { asc, eq, sql } from "drizzle-orm"

import { withDb } from "@/db"
import { puzzle } from "@/db/schema"

/**
 * One Coach's Puzzles, named and in the order the Library shows them.
 *
 * `lower()` because the sort is otherwise the database's collation: the e2e
 * container provides C, which puts every lowercase name below every
 * capitalised one, and Neon's glibc en_US.UTF-8 does not — so the two would
 * disagree about the same Library.
 */
export function listPuzzlesByCoach(coachId: string) {
  return withDb((db) =>
    db
      .select({ id: puzzle.id, name: puzzle.name })
      .from(puzzle)
      .where(eq(puzzle.coachId, coachId))
      .orderBy(asc(sql`lower(${puzzle.name})`))
  )
}
