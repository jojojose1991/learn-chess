import { beforeAll, describe, expect, it } from "vitest"

import { adminEmail, createAuth, isAdmin } from "./auth"

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
 * Admin-ness is deploy configuration, not data: the Coach `SEED_ADMIN_USER`
 * names is the admin, no role column is read, and no promote or demote exists.
 */
describe("isAdmin", () => {
  it("is the Coach SEED_ADMIN_USER names, whatever the casing", () => {
    process.env.SEED_ADMIN_USER = "Boss@Example.com"
    expect(adminEmail()).toBe("boss@example.com")
    expect(isAdmin({ email: "boss@example.com" })).toBe(true)
    expect(isAdmin({ email: "BOSS@example.com" })).toBe(true)
  })

  it("is nobody else", () => {
    process.env.SEED_ADMIN_USER = "boss@example.com"
    expect(isAdmin({ email: "someone@example.com" })).toBe(false)
  })

  /** A fresh clone, before `pnpm seed` has run. Nobody is admin, and nothing throws. */
  it("is nobody at all when the variable is unset", () => {
    process.env.SEED_ADMIN_USER = ""
    expect(adminEmail()).toBeUndefined()
    expect(isAdmin({ email: "boss@example.com" })).toBe(false)
  })
})
