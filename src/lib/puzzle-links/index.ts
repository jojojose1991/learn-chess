import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import * as links from "./service"

// Nothing is re-exported: a re-export here survives into the client bundle,
// so one through `./service` would put better-auth's server half and drizzle
// in the browser (docs/learnings/testing.md). What a Coach copies is a whole
// URL built on the server, so no screen needs a constant from this domain.

/**
 * The Coach's three, each on the Puzzle they name and each answered for the
 * Coach the session names — POST like every other read of session-scoped
 * data, because a GET response is heuristically cacheable and a stale link is
 * one a Coach has already revoked.
 */
export const fetchPuzzleLink = createServerFn({ method: "POST" })
  .validator((puzzleId: string) => puzzleId)
  .handler(({ data }) => links.readLink(data, getRequestHeaders()))

export const mintPuzzleLink = createServerFn({ method: "POST" })
  .validator((puzzleId: string) => puzzleId)
  .handler(({ data }) => links.mintLink(data, getRequestHeaders()))

export const revokePuzzleLink = createServerFn({ method: "POST" })
  .validator((puzzleId: string) => puzzleId)
  .handler(({ data }) => links.revokeLink(data, getRequestHeaders()))

/**
 * The Student's one, and the only server function in the app that reads no
 * headers at all: a Puzzle Link carries its own authority in the slug, and
 * asking who is signed in is exactly what it must not do.
 */
export const openPuzzleLink = createServerFn({ method: "POST" })
  .validator((slug: string) => slug)
  .handler(({ data }) => links.openLink(data))
