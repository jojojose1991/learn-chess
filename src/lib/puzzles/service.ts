import { listPuzzlesByCoach } from "@/db/repositories/puzzles"
import { getCoach } from "@/lib/auth"

/** One Puzzle as the Library lists it. Flat, by name — no folders, no tags. */
type LibraryPuzzle = { id: string; name: string }

/**
 * The signed-in Coach's Library, or null when there is no session. The Coach
 * comes from the session, so no request can ask for someone else's.
 *
 * Null rather than an empty list: the guard on `_coach` and this run as two
 * round trips on a client navigation, and a session that expired between them
 * would otherwise tell a Coach with a full Library they have no Puzzles.
 */
export async function listLibrary(
  headers: Headers
): Promise<LibraryPuzzle[] | null> {
  const coach = await getCoach(headers)
  if (!coach) return null
  // Named fields, not the row: widening the repository's select would
  // otherwise ship new columns to the client with no type error.
  return (await listPuzzlesByCoach(coach.id)).map(({ id, name }) => ({
    id,
    name,
  }))
}
