import { beforeAll, describe, expect, it } from "vitest"

import { adminUserIds, createAuth } from "./auth"

/**
 * The pool is built lazily. `disableSignUp` is checked before the adapter is
 * touched, so the rejection below never opens a socket.
 */
beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://nobody@localhost/nothing"
  process.env.BETTER_AUTH_SECRET = "not-a-real-secret"
  process.env.BETTER_AUTH_URL = "http://localhost:3000"
})

const signUp = {
  body: { email: "walk-in@example.com", password: "hunter22", name: "Walk in" },
}

describe("createAuth", () => {
  it("closes the sign-up endpoint, so the only way in is an invite", async () => {
    await expect(createAuth().api.signUpEmail(signUp)).rejects.toThrow(
      /sign up is not enabled/i
    )
  })

  it("closes password reset too, so no email is ever sent", async () => {
    await expect(
      createAuth().api.requestPasswordReset({
        body: { email: "walk-in@example.com" },
      })
    ).rejects.toThrow(/reset password isn't enabled/i)
  })

  it("opens sign-up for the seed script alone", () => {
    expect(createAuth({ signUp: true }).options.emailAndPassword).toMatchObject(
      {
        disableSignUp: false,
      }
    )
  })

  /** Any plugin after it never gets its Set-Cookie headers written. */
  it("keeps the cookie plugin last, with admin ahead of it", () => {
    const ids = createAuth().options.plugins.map((plugin) => plugin.id)
    expect(ids.at(-1)).toBe("tanstack-start-cookies")
    expect(ids.indexOf("admin")).toBeGreaterThanOrEqual(0)
    expect(ids.indexOf("admin")).toBeLessThan(ids.length - 1)
  })
})

/**
 * Admin-ness is deploy configuration, not data: no role column is read, and no
 * promote or demote exists. An empty value is the state a fresh clone is in
 * before `pnpm seed` has produced an id to name, so it must not throw.
 */
describe("adminUserIds", () => {
  it("reads a comma-separated ADMIN_USER_IDS", () => {
    process.env.ADMIN_USER_IDS = " abc , def ,,"
    expect(adminUserIds()).toEqual(["abc", "def"])
  })

  it("names nobody when the variable is unset", () => {
    process.env.ADMIN_USER_IDS = ""
    expect(adminUserIds()).toEqual([])
  })
})
