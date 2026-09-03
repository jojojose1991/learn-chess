import { beforeAll, describe, expect, it } from "vitest"

import { Route } from "@/routes/api/auth/$"

/** The handler is never reached for a closed path, so no socket is opened. */
beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://nobody@localhost/nothing"
  process.env.BETTER_AUTH_SECRET = "not-a-real-secret"
  process.env.BETTER_AUTH_URL = "http://localhost:3000"
})

// `handlers` is typed as an object or a factory; this route uses the object.
const { ANY } = Route.options.server?.handlers as {
  ANY: (ctx: { request: Request }) => Promise<Response>
}

/**
 * POST, because these endpoints are POST-only: better-auth answers 404 to a
 * GET on any of them whether the guard is there or not, so a GET test would
 * pass against an empty `closed` set. Unguarded, a POST gets 400.
 */
const call = (path: string) =>
  ANY({
    request: new Request(`http://localhost:3000${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  })

/**
 * The endpoints the admin plugin mounts and this product refuses.
 * `remove-user` reaches the `coach_id` cascade; `set-role`, `update-user` and
 * `create-user` all write the column that decides who is an admin, with no
 * screen behind them. `addCoach` is unaffected — it calls `auth.api.createUser`
 * in process, not over HTTP.
 */
describe("the auth route", () => {
  it.each([
    "/api/auth/admin/remove-user",
    "/api/auth/admin/impersonate-user",
    "/api/auth/admin/set-role",
    "/api/auth/admin/update-user",
    "/api/auth/admin/create-user",
  ])("answers 404 to %s", async (path) => {
    expect((await call(path)).status).toBe(404)
  })
})
