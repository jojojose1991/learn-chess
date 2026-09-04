import { count, eq } from "drizzle-orm"

import { withDb } from "@/db"
import { puzzle, user } from "@/db/schema"

import type { BoardTheme } from "@/db/schema"

/**
 * Every Coach with how many Puzzles they own, by email. Our own query because
 * the admin plugin's `listUsers` cannot count Puzzles; every write on this
 * table but the board theme below is still the plugin's.
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

/** The one write to `board_theme`; the plugin's auth API will not set it. */
export function updateBoardTheme(coachId: string, theme: BoardTheme) {
  return withDb((db) =>
    db.update(user).set({ boardTheme: theme }).where(eq(user.id, coachId))
  )
}
