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

const call = (path: string) =>
  ANY({ request: new Request(`http://localhost:3000${path}`) })

/**
 * The endpoints the admin plugin mounts and this product refuses.
 * `remove-user` reaches the `coach_id` cascade; `set-role` and `update-user`
 * write the column that decides who is an admin, with no screen behind them.
 */
describe("the auth route", () => {
  it.each([
    "/api/auth/admin/remove-user",
    "/api/auth/admin/impersonate-user",
    "/api/auth/admin/set-role",
    "/api/auth/admin/update-user",
  ])("answers 404 to %s", async (path) => {
    expect((await call(path)).status).toBe(404)
  })
})
