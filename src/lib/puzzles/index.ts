import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import * as puzzles from "./service"

/**
 * POST like every other read of session-scoped data: a GET response is
 * heuristically cacheable, and a stale Library is one Coach seeing another's.
 */
export const fetchLibrary = createServerFn({ method: "POST" }).handler(() =>
  puzzles.listLibrary(getRequestHeaders())
)
