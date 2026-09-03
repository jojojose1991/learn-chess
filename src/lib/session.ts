import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import { getCoach } from "@/lib/auth"

export type { Coach } from "@/lib/auth"

/**
 * The signed-in Coach, or null. Read on the server from the session cookie so
 * a guard can run before a Coach-only route renders — on the first request as
 * well as on client navigation.
 *
 * POST, not GET: a GET response is heuristically cacheable, and a browser
 * serving a stale session after sign-out would leave a signed-out Coach
 * looking signed in.
 */
export const fetchCoach = createServerFn({ method: "POST" }).handler(() =>
  getCoach(getRequestHeaders())
)
