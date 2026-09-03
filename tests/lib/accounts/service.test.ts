import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

/**
 * Who may read the accounts list, and what a caller who may not is told. Both
 * questions are answered before anything is queried or validated, so the
 * refusals are what this covers — the writes themselves answer to BetterAuth's
 * own admin check, which `tests/lib/auth.test.ts` pins.
 */
describe("refusing a Coach who is not an admin", () => {
  const invite = { email: "new@example.com", name: "New", password: "hunter22" }

  /** A signed-in Coach with no roles, which is every Coach but the seeded one. */
  function asPlainCoach() {
    vi.doMock("@/lib/auth", () => ({
      getCoach: async () => ({
        id: "c1",
        email: "coach@example.com",
        isAdmin: false,
      }),
      getAuth: () => {
        throw new Error("createUser was reached")
      },
    }))
    // The repository would throw rather than return rows, so a refusal that
    // queries first fails here instead of passing quietly.
    vi.doMock("@/db/repositories/accounts", () => ({
      listCoachesWithPuzzleCounts: () => {
        throw new Error("the accounts table was read")
      },
    }))
    return import("@/lib/accounts/service")
  }

  beforeEach(() => vi.resetModules())
  afterEach(() => vi.doUnmock("@/lib/auth"))

  it("gives them no list to read, so the screen can answer 404", async () => {
    const { listAccounts } = await asPlainCoach()

    await expect(listAccounts(new Headers())).resolves.toBeNull()
  })

  it("tells them nothing about the password rule, because they cannot add a Coach anyway", async () => {
    const { createCoach } = await asPlainCoach()

    // Short on purpose: the password rule would reject it, and saying so would
    // describe a form this caller may not use.
    const refused = await createCoach(
      { ...invite, password: "x" },
      new Headers()
    )

    expect(refused).toEqual({ error: "That did not work." })
  })
})
