import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { newCoachBody } from "@/lib/accounts/service"

import type { NewCoach } from "@/lib/accounts/rules"
import type { Account } from "@/lib/accounts/service"

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

/**
 * A write BetterAuth refuses leaves no trace once the admin closes the tab —
 * `attempt()` is the one seam every write in this service passes through, so
 * this is where the fix lives rather than in each caller.
 */
describe("a write that fails", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock("@/lib/auth", () => ({
      getCoach: async () => ({
        id: "admin1",
        email: "admin@example.com",
        isAdmin: true,
      }),
      getAuth: () => ({
        api: {
          createUser: async () => {
            throw new Error("User already exists. Use another email.")
          },
        },
      }),
    }))
  })

  afterEach(() => vi.doUnmock("@/lib/auth"))

  it("logs the error it converts, before returning the admin their message", async () => {
    vi.doMock("@/lib/log", () => ({ log: { error: vi.fn() } }))
    const { createCoach } = await import("@/lib/accounts/service")
    const { log } = await import("@/lib/log")

    const result = await createCoach(
      { email: "new@example.com", name: "New", password: "hunter22" },
      new Headers()
    )

    expect(result).toEqual({ error: "User already exists. Use another email." })
    expect(log.error).toHaveBeenCalledTimes(1)
    const [build] = vi.mocked(log.error).mock.calls[0] as [() => string]
    expect(build()).toContain("User already exists. Use another email.")
  })
})

/**
 * What crosses to the client: an explicit DTO whose fields are named one by
 * one. The compiler's excess-property check does not fire through a spread, so
 * this is what stops a column added to the repository query reaching `/admin`.
 */
describe("listAccounts DTO mapping", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock("@/lib/auth", () => ({
      getCoach: async () => ({
        id: "admin1",
        email: "admin@example.com",
        isAdmin: true,
      }),
    }))
  })

  afterEach(() => {
    vi.doUnmock("@/lib/auth")
    vi.doUnmock("@/db/repositories/accounts")
  })

  it("names each field, so an extra column on the select never reaches /admin", async () => {
    vi.doMock("@/db/repositories/accounts", () => ({
      listCoachesWithPuzzleCounts: async () => [
        {
          id: "c1",
          email: "coach@example.com",
          name: "Coach",
          banned: false,
          puzzles: 3,
          role: "admin",
          extraSecret: "leaked",
        },
      ],
    }))

    const { listAccounts } = await import("@/lib/accounts/service")
    const accounts = await listAccounts(new Headers())

    expect(accounts).toEqual([
      {
        id: "c1",
        email: "coach@example.com",
        name: "Coach",
        puzzles: 3,
        revoked: false,
      },
    ])
    expect(accounts?.[0]).not.toHaveProperty("role")
    expect(accounts?.[0]).not.toHaveProperty("extraSecret")
    expect(Object.keys(accounts?.[0] ?? {}).sort()).toEqual([
      "email",
      "id",
      "name",
      "puzzles",
      "revoked",
    ])
  })

  it("maps banned to revoked, so the client receives product semantics rather than database flags", async () => {
    vi.doMock("@/db/repositories/accounts", () => ({
      listCoachesWithPuzzleCounts: async () => [
        {
          id: "c1",
          email: "banned@example.com",
          name: "Banned",
          banned: true,
          puzzles: 0,
        },
        {
          id: "c2",
          email: "active@example.com",
          name: "Active",
          banned: null,
          puzzles: 1,
        },
      ],
    }))

    const { listAccounts } = await import("@/lib/accounts/service")
    const accounts = await listAccounts(new Headers())

    expect(accounts?.map((a) => a.revoked)).toEqual([true, false])
  })

  it("fails if a field is added to the DTO without being named, keeping the contract explicit", async () => {
    // Record<keyof Account, true> fails typecheck if a field is added to Account
    // without being added here, proving that every DTO field is accounted for.
    const accountKeys: Record<keyof Account, true> = {
      id: true,
      email: true,
      name: true,
      puzzles: true,
      revoked: true,
    }
    const expectedKeys = Object.keys(accountKeys).sort()

    vi.doMock("@/db/repositories/accounts", () => ({
      listCoachesWithPuzzleCounts: async () => [
        {
          id: "c1",
          email: "coach@example.com",
          name: "Coach",
          banned: false,
          puzzles: 1,
        },
      ],
    }))

    const { listAccounts } = await import("@/lib/accounts/service")
    const accounts = await listAccounts(new Headers())
    const account = accounts?.[0]
    expect(account).toBeDefined()

    expect(Object.keys(account!).sort()).toEqual(expectedKeys)
  })
})
