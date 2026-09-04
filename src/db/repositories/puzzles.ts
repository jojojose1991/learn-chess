import { and, asc, eq, sql } from "drizzle-orm"

import { withDb } from "@/db"
import { puzzle } from "@/db/schema"

/** The columns a Coach writes. `id`, `coach_id` and the timestamps are not. */
type PuzzleFields = Omit<
  typeof puzzle.$inferInsert,
  "id" | "coachId" | "createdAt" | "updatedAt"
>

/**
 * One Coach's Puzzles, with the Goal each one sets, in the order the Library
 * shows them.
 *
 * `lower()` because the sort is otherwise the database's collation: the e2e
 * container provides C, which puts every lowercase name below every
 * capitalised one, and Neon's glibc en_US.UTF-8 does not — so the two would
 * disagree about the same Library.
 */
export function listPuzzlesByCoach(coachId: string) {
  return withDb((db) =>
    db
      .select({
        id: puzzle.id,
        name: puzzle.name,
        goalKind: puzzle.goalKind,
        goalN: puzzle.goalN,
      })
      .from(puzzle)
      .where(eq(puzzle.coachId, coachId))
      .orderBy(asc(sql`lower(${puzzle.name})`))
  )
}

/** One Puzzle of one Coach, or nothing — another Coach's is nothing here. */
export function findPuzzleByCoach(puzzleId: string, coachId: string) {
  return withDb((db) =>
    db
      .select({
        id: puzzle.id,
        name: puzzle.name,
        fen: puzzle.fen,
        goalKind: puzzle.goalKind,
        goalN: puzzle.goalN,
      })
      .from(puzzle)
      .where(and(eq(puzzle.id, puzzleId), eq(puzzle.coachId, coachId)))
      .limit(1)
  )
}

export function insertPuzzle(coachId: string, fields: PuzzleFields) {
  return withDb((db) =>
    db
      .insert(puzzle)
      .values({ coachId, ...fields })
      .returning({ id: puzzle.id })
  )
}

/**
 * Rewrites one Puzzle, scoped by Coach in the `where` rather than by a read
 * before it — so a Puzzle that is not this Coach's updates no rows instead of
 * racing a check that has already passed.
 */
export function updatePuzzleByCoach(
  puzzleId: string,
  coachId: string,
  fields: PuzzleFields
) {
  return withDb((db) =>
    db
      .update(puzzle)
      .set(fields)
      .where(and(eq(puzzle.id, puzzleId), eq(puzzle.coachId, coachId)))
      .returning({ id: puzzle.id })
  )
}
