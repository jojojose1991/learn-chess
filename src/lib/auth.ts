import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { betterAuth } from "better-auth"
import { admin } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { eq } from "drizzle-orm"

import { getDb, withDb } from "@/db"
import { user } from "@/db/schema"
import { optionalEnv, requireEnv } from "@/lib/env"

/**
 * The one Coach who may work the accounts screen, named by email in
 * `SEED_ADMIN_USER` — the same Coach `pnpm seed` creates. Admin-ness is deploy
 * configuration and not data: there is no promote, no demote, and no app code
 * reads `user.role`.
 */
export function adminEmail(): string | undefined {
  return optionalEnv("SEED_ADMIN_USER")?.toLowerCase()
}

/** Whether this Coach is that admin. */
export function isAdmin(coach: { email: string }): boolean {
  const email = adminEmail()
  return email !== undefined && coach.email.toLowerCase() === email
}

/**
 * The Coach's auth. Invite-only: no sign-up route, no password reset and no
 * email verification — the admin mints Coaches on the accounts screen, and
 * `pnpm seed` mints the admin.
 *
 * `signUp` opens the sign-up endpoint on one instance, for that script alone.
 * The app itself never passes it, so the endpoint is closed in the server.
 */
export function createAuth({
  signUp = false,
  adminUserIds = [],
}: { signUp?: boolean; adminUserIds?: string[] } = {}) {
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
    // Cookie plugins go last.
    plugins: [admin({ adminUserIds }), tanstackStartCookies()],
  })
}

export type Auth = ReturnType<typeof createAuth>

let auth: Auth | undefined
let adminId: string | undefined

/**
 * Built on first use, so the secret and base URL are read when a request needs
 * them rather than when this module is imported.
 *
 * The admin is named by email, but the plugin only takes user ids, so the id
 * is looked up here. Until `pnpm seed` has made that Coach there is no id to
 * find, and the answer is not cached — which is what keeps the bootstrap to
 * one step, with no restart to pick up an id that did not exist at boot.
 */
export async function getAuth() {
  if (auth && adminId) return auth
  adminId = await findAdminId()
  return (auth = createAuth({ adminUserIds: adminId ? [adminId] : [] }))
}

async function findAdminId(): Promise<string | undefined> {
  const email = adminEmail()
  if (!email) return undefined
  const rows = await withDb((db) =>
    db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  )
  return rows.at(0)?.id
}
