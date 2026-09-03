import { beforeAll, describe, expect, it } from "vitest"

import { Route } from "./$"

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
 * Three endpoints the admin plugin mounts and this product refuses. Two of
 * them would contradict rules the product is built on: `remove-user` reaches
 * the `coach_id` cascade, and `set-role` writes the column the plugin's own
 * permission check reads, which would make an admin the app cannot see.
 */
describe("the auth route", () => {
  it.each([
    "/api/auth/admin/remove-user",
    "/api/auth/admin/impersonate-user",
    "/api/auth/admin/set-role",
  ])("answers 404 to %s", async (path) => {
    expect((await call(path)).status).toBe(404)
  })
})
