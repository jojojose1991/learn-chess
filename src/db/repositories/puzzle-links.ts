import { and, desc, eq, isNull } from "drizzle-orm"

import { withDb } from "@/db"
import { puzzle, puzzleLink } from "@/db/schema"

import type { BoardTheme } from "@/db/schema"

/**
 * A new unlisted slug for one Puzzle, on the board it is stamped with.
 *
 * Nothing is read back: the slug was drawn here-side, and the primary key is
 * what makes it unique rather than anything this could return.
 */
export function insertPuzzleLink(
  slug: string,
  puzzleId: string,
  boardTheme: BoardTheme
) {
  return withDb((db) =>
    db.insert(puzzleLink).values({ slug, puzzleId, boardTheme })
  )
}

/**
 * The open link for one Puzzle, or nothing. Newest first and one row: two
 * Coach taps racing each other would leave two open links, and the Coach is
 * then shown the one they just minted rather than whichever the database
 * happened to return first.
 */
export function findOpenLinkByPuzzle(puzzleId: string) {
  return withDb((db) =>
    db
      .select({ slug: puzzleLink.slug })
      .from(puzzleLink)
      .where(
        and(eq(puzzleLink.puzzleId, puzzleId), isNull(puzzleLink.revokedAt))
      )
      .orderBy(desc(puzzleLink.createdAt))
      .limit(1)
  )
}

/**
 * What a slug opens: the Puzzle it points at and the board it was stamped
 * with. A revoked link matches nothing here, so the row is never read back
 * out and no caller has to remember to check it.
 */
export function findOpenLinkBySlug(slug: string) {
  return withDb((db) =>
    db
      .select({
        name: puzzle.name,
        fen: puzzle.fen,
        goalKind: puzzle.goalKind,
        goalN: puzzle.goalN,
        boardTheme: puzzleLink.boardTheme,
      })
      .from(puzzleLink)
      .innerJoin(puzzle, eq(puzzle.id, puzzleLink.puzzleId))
      .where(and(eq(puzzleLink.slug, slug), isNull(puzzleLink.revokedAt)))
      .limit(1)
  )
}

/**
 * Ends every open link to one Puzzle. Every one and not the newest: a Coach
 * revokes the sharing of a Puzzle, and a second link left open by a raced
 * mint would still open it.
 *
 * Whose Puzzle it is belongs to the service, which holds that rule for all
 * three of these in one place — this only takes the id it is given.
 */
export function revokeLinksByPuzzle(puzzleId: string) {
  return withDb((db) =>
    db
      .update(puzzleLink)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(puzzleLink.puzzleId, puzzleId), isNull(puzzleLink.revokedAt))
      )
  )
}
