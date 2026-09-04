import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import * as puzzles from "./service"

import type { PuzzleDraft } from "./rules"

// Nothing is re-exported: a re-export here survives into the client bundle,
// so one through `./service` would put better-auth's server half and drizzle
// in the browser. Confirm & Edit imports `./rules` outright instead.

/**
 * POST like every other read of session-scoped data: a GET response is
 * heuristically cacheable, and a stale Library is one Coach seeing another's.
 */
export const fetchLibrary = createServerFn({ method: "POST" }).handler(() =>
  puzzles.listLibrary(getRequestHeaders())
)

export const fetchPuzzle = createServerFn({ method: "POST" })
  .validator((puzzleId: string) => puzzleId)
  .handler(({ data }) => puzzles.readPuzzle(data, getRequestHeaders()))

export const savePuzzle = createServerFn({ method: "POST" })
  .validator((data: PuzzleDraft) => data)
  .handler(({ data }) => puzzles.savePuzzle(data, getRequestHeaders()))
