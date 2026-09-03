import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { count, eq } from "drizzle-orm"

import { withDb } from "@/db"
import { puzzle, user } from "@/db/schema"
import type { Auth } from "@/lib/auth"
import { getAuth, isAdmin } from "@/lib/auth"

/** One Coach as the accounts screen lists them. */
export type Account = {
  id: string
  email: string
  name: string
  puzzles: number
  revoked: boolean
}

/**
 * Every account, or null when the caller is not an admin — the screen answers
 * 404 to that rather than refusing, so an unlisted URL does not confirm what
 * it guards.
 *
 * The list is our own query because the plugin's `listUsers` cannot count
 * Puzzles. The writes below are all the plugin's.
 */
export const fetchAccounts = createServerFn({ method: "POST" }).handler(
  async (): Promise<Account[] | null> => {
    const session = await (
      await getAuth()
    ).api.getSession({
      headers: getRequestHeaders(),
    })
    if (!session || !isAdmin(session.user)) return null

    const rows = await withDb((db) =>
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

    return rows.map(({ banned, ...row }) => ({
      ...row,
      revoked: Boolean(banned),
    }))
  }
)

/**
 * A Coach who can sign in straight away. `createUser` writes the user and the
 * credential account together, so invite-only stays invite-only: the sign-up
 * endpoint is still closed.
 */
export const addCoach = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { email: string; name: string; password: string }) => data
  )
  .handler(({ data }) =>
    attempt((auth, headers) =>
      auth.api.createUser({
        body: { email: data.email, name: data.name, password: data.password },
        headers,
      })
    )
  )

/**
 * A new password, and no session left that was signed in under the old one.
 * `setUserPassword` rewrites the credential row and nothing else, so without
 * the second call a Coach signed in elsewhere keeps working.
 */
export const setCoachPassword = createServerFn({ method: "POST" })
  .inputValidator((data: { coachId: string; password: string }) => data)
  .handler(({ data }) =>
    attempt(async (auth, headers) => {
      await auth.api.setUserPassword({
        body: { userId: data.coachId, newPassword: data.password },
        headers,
      })
      await auth.api.revokeUserSessions({
        body: { userId: data.coachId },
        headers,
      })
    })
  )

/**
 * Access withdrawn: `banUser` kills every live session and sign-in is refused
 * from then on, while the row, the Library and every Puzzle Link stay. It is
 * what this product has instead of deleting, and it refuses to ban the caller.
 */
export const revokeAccess = createServerFn({ method: "POST" })
  .inputValidator((data: { coachId: string }) => data)
  .handler(({ data }) =>
    attempt((auth, headers) =>
      auth.api.banUser({ body: { userId: data.coachId }, headers })
    )
  )

export const restoreAccess = createServerFn({ method: "POST" })
  .inputValidator((data: { coachId: string }) => data)
  .handler(({ data }) =>
    attempt((auth, headers) =>
      auth.api.unbanUser({ body: { userId: data.coachId }, headers })
    )
  )

/**
 * Run one of the plugin's writes with the caller's own headers, so the plugin
 * checks the admin itself — there is no second gate here to drift out of step
 * with the first. Both answer to `SEED_ADMIN_USER`.
 *
 * Its message is the useful one ("User already exists. Use another email.",
 * "You cannot ban yourself") and only an admin ever reads it, so it is passed
 * through unchanged.
 */
async function attempt(
  write: (auth: Auth, headers: Headers) => Promise<unknown>
): Promise<{ error?: string }> {
  try {
    await write(await getAuth(), getRequestHeaders())
    return {}
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "That did not work.",
    }
  }
}
