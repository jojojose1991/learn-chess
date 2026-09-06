import { describe, expect, it } from "vitest"

import { databaseName, isEntrypoint, withDatabase } from "../../scripts/e2e-db"

/**
 * One variable configures three databases, and the provisioner drops two of
 * them — so getting the swap wrong is the one mistake here that does not undo.
 */
describe("withDatabase", () => {
  it("keeps the server, the port and the credentials", () => {
    expect(
      withDatabase(
        "postgresql://postgres:secret@localhost:5433/learn-chess-e2e",
        "learn-chess"
      )
    ).toBe("postgresql://postgres:secret@localhost:5433/learn-chess")
  })
})

describe("databaseName", () => {
  it("is the path, without its slash", () => {
    expect(databaseName("postgresql://h/learn-chess-e2e")).toBe(
      "learn-chess-e2e"
    )
  })

  it("refuses a URL that names no database", () => {
    expect(() => databaseName("postgresql://h")).toThrow(/names no database/)
  })

  /** Dropping it would kill the connection issuing the DROP. */
  it("refuses the maintenance database it connects through", () => {
    expect(() => databaseName("postgresql://h/learn-chess")).toThrow(
      /must not name/
    )
  })
})

/**
 * The guard that decides whether importing this module also *runs* it. It
 * shipped as `import.meta.main`, which tsx leaves undefined — so `pnpm e2e:db`
 * silently provisioned nothing and every run reused the last one's database.
 */
describe("isEntrypoint", () => {
  it("runs the provisioner when the script is the file invoked", () => {
    expect(isEntrypoint("/Users/x/learn-chess/scripts/e2e-db.ts")).toBe(true)
  })

  it("stays out of the way under vitest, which imports it for the tests", () => {
    expect(
      isEntrypoint("/Users/x/node_modules/vitest/dist/workers/forks.js")
    ).toBe(false)
  })

  /** Nothing was invoked by path at all, so nothing should be dropped. */
  it("does not provision when there is no script path", () => {
    expect(isEntrypoint(undefined)).toBe(false)
  })
})
