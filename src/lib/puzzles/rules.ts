/**
 * What both sides of the network need to know about a Puzzle. Confirm & Edit
 * imports this directly and `./service` re-checks against it, so nothing
 * server-side may be imported here (docs/learnings/testing.md).
 */

import type { Goal } from "@/lib/chess/goals"

/** A Puzzle on its way to the Library: a Position, a Goal and a name. */
export type PuzzleDraft = {
  /** Absent for a Puzzle being written for the first time. */
  id?: string
  name: string
  fen: string
  goal: Goal
}

/**
 * The Goal's ceiling, which is the number input's `max` as much as the
 * service's. Ten is far past anything a five-year-old is set; it is here so a
 * slip on a number pad cannot store a Goal no Student could reach.
 */
export const GOAL_N_MIN = 1
export const GOAL_N_MAX = 10

/** Long enough for a name, short enough to stay one line of the Library. */
export const NAME_MAX = 100
