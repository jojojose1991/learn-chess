import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as auth from "@/lib/auth"
import type { BoardTheme } from "@/db/schema"

/**
 * The only write to `board_theme`, so what reaches the row is decided here.
 * Input arrives as JSON the type system never saw — a server function's
 * validator is an annotation and strips nothing — and there is no CHECK
 * constraint behind the column, so the check cannot be somebody else's.
 */
describe("a Coach choosing their board theme", () => {
  const written: Array<[string, string]> = []

  /**
   * Signed in as `c1`, with the repository recording what it is asked to
   * write. Only the session is faked: `isBoardTheme` is the rule under test
   * here as much as the service is, so it stays the real one.
   */
  function asCoach(coach: { id: string } | null = { id: "c1" }) {
    vi.doMock("@/lib/auth", async (importOriginal) => ({
      ...(await importOriginal<typeof auth>()),
      getCoach: async () => coach,
    }))
    vi.doMock("@/db/repositories/accounts", () => ({
      updateBoardTheme: async (coachId: string, theme: string) => {
        written.push([coachId, theme])
      },
    }))
    return import("@/lib/board-theme/service")
  }

  beforeEach(() => {
    written.length = 0
    vi.resetModules()
  })
  afterEach(() => {
    vi.doUnmock("@/lib/auth")
    vi.doUnmock("@/db/repositories/accounts")
  })

  it("writes it to the Coach the session names, not to whoever the request says", async () => {
    const { chooseBoardTheme } = await asCoach()

    await chooseBoardTheme("brown", new Headers())

    expect(written).toEqual([["c1", "brown"]])
  })

  it("refuses a theme no board is painted in, so a Coach is never left with colourless squares", async () => {
    const { chooseBoardTheme } = await asCoach()

    await chooseBoardTheme("tartan" as BoardTheme, new Headers())

    expect(written).toEqual([])
  })

  it("writes nothing for a caller with no session, so a theme needs a Coach to belong to", async () => {
    const { chooseBoardTheme } = await asCoach(null)

    await chooseBoardTheme("brown", new Headers())

    expect(written).toEqual([])
  })
})
