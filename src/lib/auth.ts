import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { betterAuth } from "better-auth"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { getDb } from "@/db"
import { requireEnv } from "@/lib/env"

/**
 * The Coach's auth. Invite-only: no sign-up route, no password reset and no
 * email verification — an admin mints Coaches with `pnpm seed`.
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
    // Cookie plugins go last.
    plugins: [tanstackStartCookies()],
  })
}

let auth: ReturnType<typeof createAuth> | undefined

/** Built on first use, so the secret and base URL are read per request. */
export function getAuth() {
  return (auth ??= createAuth())
}
