import { createAuthClient } from "better-auth/react"

/**
 * The browser's half of auth. Same-origin, so the default base URL of
 * `/api/auth` is already the route mounted at `src/routes/api/auth/$.ts`.
 */
export const authClient = createAuthClient()
