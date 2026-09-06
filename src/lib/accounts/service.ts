import { listCoachesWithPuzzleCounts } from "@/db/repositories/accounts"
import { getAuth, getCoach } from "@/lib/auth"
import { log } from "@/lib/log"
import { MIN_PASSWORD } from "./rules"

import type { NewAccess, NewCoach, NewPassword } from "./rules"

/** One Coach as the accounts screen lists them. */
export type Account = {
  id: string
  email: string
  name: string
  puzzles: number
  revoked: boolean
}

/**
 * The three fields an invite may set, and nothing else.
 *
 * `createUser` also accepts `role` and `banned` — and reads `role` out of a
 * nested `data` bag — while the controller's `validator` is a type annotation
 * that strips nothing at runtime. Forwarding the input object whole would let an
 * admin mint a second admin through the accounts screen, which `pnpm seed` is
 * supposed to be the only way to do. So the body is built field by field, and
 * the test says why.
 */
export function newCoachBody({ email, name, password }: NewCoach) {
  return { email, name, password }
}
/**
 * Every account, or null when the caller is not an admin — the screen answers
 * 404 to that rather than refusing, so an unlisted URL does not confirm what
 * it guards.
 */
export async function listAccounts(
  headers: Headers
): Promise<Account[] | null> {
  const coach = await getCoach(headers)
  if (!coach?.isAdmin) return null

  // Named fields, not the row: widening the repository's select would
  // otherwise ship new columns to the client with no type error.
  return (await listCoachesWithPuzzleCounts()).map(
    ({ id, email, name, puzzles, banned }) => ({
      id,
      email,
      name,
      puzzles,
      revoked: Boolean(banned),
    })
  )
}

/**
 * A Coach who can sign in straight away. `createUser` writes the user and the
 * credential account together, so invite-only stays invite-only: the sign-up
 * endpoint is still closed.
 */
export async function createCoach(input: NewCoach, headers: Headers) {
  // Before the password rule, so a caller who may not add Coaches learns
  // nothing about what a password has to be — the plugin's own check below is
  // the gate, but it runs too late to keep that quiet.
  const coach = await getCoach(headers)
  if (!coach?.isAdmin) return { error: "That did not work." }

  if (input.password.length < MIN_PASSWORD)
    return { error: `A password needs at least ${MIN_PASSWORD} characters.` }

  return attempt(() =>
    getAuth().api.createUser({ body: newCoachBody(input), headers })
  )
}

/**
 * A new password, and no session left that was signed in under the old one.
 * `setUserPassword` rewrites the credential row and nothing else, so without
 * the second call a Coach signed in elsewhere keeps working.
 */
export function resetCoachPassword(input: NewPassword, headers: Headers) {
  return attempt(async () => {
    const auth = getAuth()
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
export function setAccess(input: NewAccess, headers: Headers) {
  return attempt(() => {
    const auth = getAuth()
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
  write: () => Promise<unknown>
): Promise<{ error?: string }> {
  try {
    await write()
    return {}
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "That did not work."
    log.error(() => `accounts write failed: ${message}`)
    return { error: message }
  }
}
