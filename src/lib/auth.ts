import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { betterAuth } from "better-auth"
import { admin } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { getDb } from "@/db"
import { requireEnv } from "@/lib/env"

/**
 * The role that may work the accounts screen. `user.role` is the plugin's own
 * column and its own permission check reads it, so this is the single
 * definition of admin — the app and the library cannot disagree about who is
 * one, which they would if admin-ness lived anywhere else.
 *
 * Every other Coach is created with the plugin's `defaultRole` of "user".
 * Roles that mean something to the product are a later design; for now the
 * column separates the admin from everyone else and nothing more.
 */
export const ADMIN_ROLE = "admin"

/**
 * Whether this Coach is an admin. `role` holds a comma-separated list once a
 * Coach has more than one, which is why this is not an equality test.
 */
export function isAdmin(coach: { role?: string | null }): boolean {
  return (
    coach.role?.split(",").some((role) => role.trim() === ADMIN_ROLE) ?? false
  )
}

/** The signed-in Coach as the product sees them, not as BetterAuth stores them. */
export type Coach = { id: string; email: string; isAdmin: boolean }

/**
 * Who these request headers are signed in as, or null. Reading the session is
 * the auth module's job, so nothing above it has to know that admin-ness is a
 * column on `user` or that BetterAuth is what answers.
 */
export async function getCoach(headers: Headers): Promise<Coach | null> {
  const session = await getAuth().api.getSession({ headers })
  if (!session) return null
  return {
    id: session.user.id,
    email: session.user.email,
    isAdmin: isAdmin(session.user),
  }
}

/**
 * The Coach's auth. Invite-only: no sign-up route, no password reset and no
 * email verification — the admin mints Coaches on the accounts screen, and
 * `pnpm seed` mints the admin.
 *
 * `signUp` opens the sign-up endpoint on one instance, for that script alone.
 * The app itself never passes it, so the endpoint is closed in the server.
 */
export function createAuth({ signUp = false }: { signUp?: boolean } = {}) {
  return betterAuth({
    baseURL: requireEnv("BETTER_AUTH_URL"),
    secret: requireEnv("BETTER_AUTH_SECRET"),
    database: drizzleAdapter(getDb(), { provider: "pg" }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !signUp,
      // A script has no response to set a session cookie on.
      autoSignIn: false,
    },
    user: {
      additionalFields: {
        // Stored on the Coach so the theme they teach on follows them
        // between devices. Not settable through the auth API.
        boardTheme: {
          type: "string",
          required: false,
          defaultValue: "green",
          input: false,
        },
      },
    },
    // A documented 2–3x improvement on /get-session.
    advanced: { database: { joins: true } },
    // Cookie plugins go last. `admin()` takes its defaults: `defaultRole`
    // "user" on every create, and `adminRoles` ["admin"] — ADMIN_ROLE above.
    plugins: [admin(), tanstackStartCookies()],
  })
}

let auth: ReturnType<typeof createAuth> | undefined

/** Built on first use, so the secret and base URL are read per request. */
export function getAuth() {
  return (auth ??= createAuth())
}
