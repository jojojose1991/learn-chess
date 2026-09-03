import { beforeAll, describe, expect, it, vi } from "vitest"

import { withDb } from "@/db"
import { log } from "@/lib/log"

/** The pool is built lazily and never queried here, so no socket is opened. */
beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://nobody@localhost/nothing"
})

/**
 * The shape production actually sees: drizzle wraps the `pg` error, so the
 * code is one level down. A bare `.code` never reaches `withDb`.
 */
const failWith = (code: string) =>
  new Error(`select 1`, { cause: Object.assign(new Error(code), { code }) })

describe("withDb", () => {
  it("returns the query's result", async () => {
    await expect(withDb(async () => "rows")).resolves.toBe("rows")
  })

  it("retries once when the connection went away", async () => {
    let attempts = 0
    const result = await withDb(async () => {
      attempts += 1
      if (attempts === 1) throw failWith("57P01")
      return "rows"
    })

    expect(result).toBe("rows")
    expect(attempts).toBe(2)
  })

  it("logs when the retry fires, so a Neon resume is visible afterwards", async () => {
    const warn = vi.spyOn(log, "warn").mockImplementation(() => {})
    let attempts = 0

    await withDb(async () => {
      attempts += 1
      if (attempts === 1) throw failWith("57P01")
      return "rows"
    })

    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it("gives up after one retry rather than looping", async () => {
    let attempts = 0
    await expect(
      withDb(async () => {
        attempts += 1
        throw failWith("ECONNRESET")
      })
    ).rejects.toThrow("select 1")

    expect(attempts).toBe(2)
  })

  it("looks past the wrapper for the driver's code", () => {
    // Guards the fix for reading `.code` off the wrapper, where it is absent.
    expect(Object.hasOwn(failWith("57P01"), "code")).toBe(false)
  })

  it("does not retry a query that failed on its own merits", async () => {
    let attempts = 0
    await expect(
      withDb(async () => {
        attempts += 1
        // 23505 unique_violation: retrying would fail identically.
        throw failWith("23505")
      })
    ).rejects.toThrow("select 1")

    expect(attempts).toBe(1)
  })
})
