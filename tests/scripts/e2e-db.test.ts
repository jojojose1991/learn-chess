import { describe, expect, it } from "vitest"

import { databaseName, withDatabase } from "../../scripts/e2e-db"

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
