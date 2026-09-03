import { describe, expect, it } from "vitest"

import { newCoachBody } from "@/lib/accounts/service"

import type { NewCoach } from "@/lib/accounts/rules"

/**
 * The accounts screen may add a Coach. It may not decide what that Coach *is*.
 * `createUser` accepts `role` and `banned`, `pnpm seed` is the only thing that
 * grants admin, and the server function's `inputValidator` is a type — it
 * strips nothing at runtime. So the narrowing has to happen here.
 */
describe("newCoachBody", () => {
  const invite = { email: "new@example.com", name: "New", password: "hunter22" }

  /**
   * Input as it actually arrives: JSON over the wire, which TypeScript never
   * saw. Excess-property checking would reject these at a literal call site,
   * which is exactly why it is no defence here.
   */
  const fromWire = (extra: Record<string, unknown>): NewCoach => ({
    ...invite,
    ...extra,
  })

  it("passes the three fields a new Coach is allowed to set", () => {
    expect(newCoachBody(invite)).toEqual(invite)
  })

  it("drops a role, so an admin cannot mint a second admin", () => {
    const body = newCoachBody(fromWire({ role: "admin" }))
    expect(body).not.toHaveProperty("role")
    expect(body).toEqual(invite)
  })

  /** `createUser` reads `body.data.role` as well as `body.role`. */
  it("drops a nested data bag, so neither does the long way round", () => {
    const body = newCoachBody(fromWire({ data: { role: "admin" } }))
    expect(body).not.toHaveProperty("data")
  })

  it("drops a ban, so a Coach cannot arrive already revoked", () => {
    expect(newCoachBody(fromWire({ banned: true }))).not.toHaveProperty(
      "banned"
    )
  })
})
