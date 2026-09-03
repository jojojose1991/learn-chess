import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import { getAuth, isAdmin } from "@/lib/auth"

export type Coach = { id: string; email: string; isAdmin: boolean }

/**
 * The signed-in Coach, or null. Read on the server from the session cookie so
 * a guard can run before a Coach-only route renders — on the first request as
 * well as on client navigation.
 *
 * POST, not GET: a GET response is heuristically cacheable, and a browser
 * serving a stale session after sign-out would leave a signed-out Coach
 * looking signed in.
 */
export const fetchCoach = createServerFn({ method: "POST" }).handler(
  async (): Promise<Coach | null> => {
    const session = await getAuth().api.getSession({
      headers: getRequestHeaders(),
    })
    if (!session) return null
    return {
      id: session.user.id,
      email: session.user.email,
      isAdmin: isAdmin(session.user),
    }
  }
)
