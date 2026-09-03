import { listCoachesWithPuzzleCounts } from "@/db/repositories/accounts"
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
 * BetterAuth's own default (`emailAndPassword.minPasswordLength`), which its
 * `setUserPassword` enforces but its `createUser` does not — so the check in
 * `createCoach` below is ours, and the two routes in cannot disagree.
 */
export const MIN_PASSWORD = 8

/**
 * Every account, or null when the caller is not an admin — the screen answers
 * 404 to that rather than refusing, so an unlisted URL does not confirm what
 * it guards.
 */
export async function listAccounts(
  headers: Headers
): Promise<Account[] | null> {
  const session = await getAuth().api.getSession({ headers })
  if (!session || !isAdmin(session.user)) return null

  return (await listCoachesWithPuzzleCounts()).map(({ banned, ...row }) => ({
    ...row,
    revoked: Boolean(banned),
  }))
}

/**
 * A Coach who can sign in straight away. `createUser` writes the user and the
 * credential account together, so invite-only stays invite-only: the sign-up
 * endpoint is still closed.
 */
export function createCoach(
  input: { email: string; name: string; password: string },
  headers: Headers
) {
  if (input.password.length < MIN_PASSWORD)
    return Promise.resolve({
      error: `A password needs at least ${MIN_PASSWORD} characters.`,
    })

  return attempt((auth) =>
    auth.api.createUser({
      body: { email: input.email, name: input.name, password: input.password },
      headers,
    })
  )
}

/**
 * A new password, and no session left that was signed in under the old one.
 * `setUserPassword` rewrites the credential row and nothing else, so without
 * the second call a Coach signed in elsewhere keeps working.
 */
export function resetCoachPassword(
  input: { coachId: string; password: string },
  headers: Headers
) {
  return attempt(async (auth) => {
    await auth.api.setUserPassword({
      body: { userId: input.coachId, newPassword: input.password },
      headers,
    })
    await auth.api.revokeUserSessions({
      body: { userId: input.coachId },
      headers,
    })
  })
}

/**
 * Access withdrawn or given back. `banUser` kills every live session and
 * sign-in is refused from then on, while the row, the Library and every Puzzle
 * Link stay — it is what this product has instead of deleting. It also refuses
 * to ban the caller, so an admin cannot revoke themselves.
 */
export function setAccess(
  input: { coachId: string; revoked: boolean },
  headers: Headers
) {
  return attempt((auth) => {
    const body = { userId: input.coachId }
    return input.revoked
      ? auth.api.banUser({ body, headers })
      : auth.api.unbanUser({ body, headers })
  })
}

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
  write: (auth: ReturnType<typeof getAuth>) => Promise<unknown>
): Promise<{ error?: string }> {
  try {
    await write(getAuth())
    return {}
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "That did not work.",
    }
  }
}
