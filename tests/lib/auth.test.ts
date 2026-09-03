import { beforeAll, describe, expect, it } from "vitest"

import { createAuth, isAdmin } from "@/lib/auth"

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
 * `user.role` is the one definition of admin, because the plugin's own
 * permission check reads the same column. Anything that disagreed with it
 * would be an admin the product could not see, or the other way round.
 */
describe("isAdmin", () => {
  it("is a Coach whose role is admin", () => {
    expect(isAdmin({ role: "admin" })).toBe(true)
  })

  /** The plugin stores several roles comma-separated, so this is no equality test. */
  it("is a Coach who is an admin among other roles", () => {
    expect(isAdmin({ role: "user,admin" })).toBe(true)
  })

  /**
   * Not trimmed, because better-auth's own `hasPermission` splits on "," and
   * does not trim either. A padded role that read as admin here would render
   * the accounts screen and then be refused by every write on it, with no way
   * back. Agreeing with the library beats being right on our own.
   */
  it("is not a Coach whose role is padded, because the plugin agrees", () => {
    expect(isAdmin({ role: "user, admin" })).toBe(false)
  })

  it("is not the default role every other Coach gets", () => {
    expect(isAdmin({ role: "user" })).toBe(false)
    expect(isAdmin({ role: "administrator" })).toBe(false)
  })

  /** A row from before the column existed, or one the plugin has not touched. */
  it("is not a Coach with no role at all", () => {
    expect(isAdmin({ role: null })).toBe(false)
    expect(isAdmin({})).toBe(false)
  })
})
