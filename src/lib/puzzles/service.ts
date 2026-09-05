import {
  findPuzzleByCoach,
  insertPuzzle,
  listPuzzlesByCoach,
  updatePuzzleByCoach,
} from "@/db/repositories/puzzles"
import { getCoach } from "@/lib/auth"
import { validatePosition } from "@/lib/chess/rules"
import { GOAL_N_MAX, GOAL_N_MIN, NAME_MAX, isPuzzleId } from "./rules"

import type { PuzzleDraft } from "./rules"

import type { Goal } from "@/lib/chess/goals"

/** One Puzzle as the Library lists it. Flat, by name — no folders, no tags. */
type LibraryPuzzle = { id: string; name: string; goal: Goal }

/** One Puzzle as Confirm & Edit reopens it: a draft that is already written. */
export type EditablePuzzle = PuzzleDraft & { id: string }

/**
 * Why this draft cannot be saved, in a sentence for the Coach, or null.
 *
 * The screen refuses the same three things at the controls that caused them,
 * but a `createServerFn` validator is a type annotation and strips nothing at
 * runtime — so this is the check that actually holds, not a second opinion.
 */
export function draftRefusal(draft: PuzzleDraft): string | null {
  // Widened on purpose, and before anything is read off it: the type says
  // what a draft is, and what arrived need not be one at all.
  const arrived: {
    name?: unknown
    fen?: unknown
    goal?: { kind?: unknown; n?: unknown } | null
  } = draft
  if (
    typeof arrived.name !== "string" ||
    typeof arrived.fen !== "string" ||
    typeof arrived.goal !== "object" ||
    arrived.goal === null
  )
    return "That is not a Puzzle we can save."

  const name = arrived.name.trim()
  if (name.length === 0) return "A Puzzle needs a name."
  if (name.length > NAME_MAX)
    return `A name can be at most ${NAME_MAX} characters.`

  if (arrived.goal.kind !== "mate_in") return "That is not a Goal we have."
  const { n } = arrived.goal
  if (
    typeof n !== "number" ||
    !Number.isInteger(n) ||
    n < GOAL_N_MIN ||
    n > GOAL_N_MAX
  )
    return `Mate in has to be a whole number from ${GOAL_N_MIN} to ${GOAL_N_MAX}.`

  const position = validatePosition(arrived.fen)
  if (!position.ok) return position.reasons.join(" ")

  return null
}

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
  return (await listPuzzlesByCoach(coach.id)).map(
    ({ id, name, goalKind, goalN }) => ({
      id,
      name,
      goal: { kind: goalKind, n: goalN },
    })
  )
}

/** One of the Coach's own Puzzles, ready to be edited again, or null. */
export async function readPuzzle(
  puzzleId: string,
  headers: Headers
): Promise<EditablePuzzle | null> {
  const coach = await getCoach(headers)
  if (!coach || !isPuzzleId(puzzleId)) return null

  // `.at`, not destructuring: the tuple type says a row is always there and
  // an empty result is exactly the case this has to answer null to.
  const row = (await findPuzzleByCoach(puzzleId, coach.id)).at(0)
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    fen: row.fen,
    goal: { kind: row.goalKind, n: row.goalN },
  }
}

/**
 * Writes a Puzzle to the Coach's own Library — a new one, or the one the
 * draft names. The Coach is the session's, never the request's, so the id in
 * a draft can only ever reach a Puzzle that is already theirs.
 */
export async function savePuzzle(
  draft: PuzzleDraft,
  headers: Headers
): Promise<{ id: string } | { error: string }> {
  const coach = await getCoach(headers)
  if (!coach) return { error: "Sign in again to save this." }

  const refusal = draftRefusal(draft)
  if (refusal) return { error: refusal }

  const fields = {
    name: draft.name.trim(),
    fen: draft.fen,
    goalKind: draft.goal.kind,
    goalN: draft.goal.n,
  }

  if (!draft.id) {
    const [written] = await insertPuzzle(coach.id, fields)
    return { id: written.id }
  }

  if (!isPuzzleId(draft.id)) return { error: "That puzzle no longer exists." }
  const written = (await updatePuzzleByCoach(draft.id, coach.id, fields)).at(0)
  // No row matched: someone else's Puzzle, or one that has gone. Either way
  // nothing was written, and saying so beats a Save that quietly did nothing.
  if (!written) return { error: "That puzzle no longer exists." }
  return { id: written.id }
}
