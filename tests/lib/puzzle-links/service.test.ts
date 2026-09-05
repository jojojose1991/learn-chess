import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as auth from "@/lib/auth"
import type { BoardTheme } from "@/db/schema"

/** White plays Qg7 mate; Black is not already in check, so it is legal too. */
const PUZZLE = {
  id: "11111111-1111-4111-8111-111111111111",
  coachId: "c1",
  name: "Back rank mate",
  fen: "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1",
  goalKind: "mate_in" as const,
  goalN: 1,
}

type LinkRow = {
  slug: string
  puzzleId: string
  boardTheme: BoardTheme
  revokedAt: Date | null
}

/** The `puzzle_link` table, and who is signed in, for one test at a time. */
let links: Array<LinkRow> = []
let session: { id: string; boardTheme: BoardTheme } | null = null

/**
 * Postgres raises on a uuid column compared against a string that is not one,
 * and every one of these queries has a `puzzle_id` in its `where` — so the
 * fake raises there too. A guard the service dropped would show up here as
 * the 500 a Coach would actually get.
 */
function asUuid(puzzleId: string): string {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(puzzleId))
    throw new Error(`invalid input syntax for type uuid: "${puzzleId}"`)
  return puzzleId
}

// Only the session and the two tables are faked. The slug, the URL and the
// DTO are the subjects here, so they stay the real ones — and the ownership
// each query scopes itself by is a `where` clause, so the fake keeps it
// rather than trusting the service to remember.
vi.doMock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof auth>()),
  getCoach: async () => session,
}))

vi.doMock("@/db/repositories/puzzles", () => ({
  findPuzzleByCoach: async (puzzleId: string, coachId: string) =>
    asUuid(puzzleId) === PUZZLE.id && PUZZLE.coachId === coachId
      ? [PUZZLE]
      : [],
}))

// None of these knows whose Puzzle it is, because the real ones do not
// either: the Coach is checked once in the service, so a check dropped there
// revokes a stranger's link here rather than being caught by a fake that
// happened to hold the rule too.
vi.doMock("@/db/repositories/puzzle-links", () => ({
  insertPuzzleLink: async (
    slug: string,
    puzzleId: string,
    boardTheme: BoardTheme
  ) => {
    links.push({
      slug,
      puzzleId: asUuid(puzzleId),
      boardTheme,
      revokedAt: null,
    })
  },
  findOpenLinkByPuzzle: async (puzzleId: string) =>
    links
      .filter((link) => link.puzzleId === asUuid(puzzleId) && !link.revokedAt)
      // The newest, which is what `order by created_at desc limit 1` answers.
      .slice(-1)
      .map(({ slug }) => ({ slug })),
  findOpenLinkBySlug: async (slug: string) =>
    links
      .filter((link) => link.slug === slug && !link.revokedAt)
      .map((link) => ({
        name: PUZZLE.name,
        fen: PUZZLE.fen,
        goalKind: PUZZLE.goalKind,
        goalN: PUZZLE.goalN,
        boardTheme: link.boardTheme,
      })),
  revokeLinksByPuzzle: async (puzzleId: string) => {
    for (const link of links) {
      if (link.puzzleId === asUuid(puzzleId)) link.revokedAt = new Date()
    }
  },
}))

// Imported once, after the mocks and never again: `@/lib/auth` pulls in
// better-auth and drizzle, and resetting the registry per test spends that
// import twelve times over.
const { mintLink, openLink, readLink, revokeLink } =
  await import("@/lib/puzzle-links/service")

/** The eight characters a Student's URL ends in. */
function slugOf(url: string): string {
  return new URL(url).pathname.split("/").pop()!
}

/**
 * A Puzzle Link is the one read in this product that has no session at all,
 * so what crosses to a Student is decided here and nowhere above. Two things
 * this holds that no screen can: that the board is the one stamped at minting
 * rather than whatever the Coach teaches on now, and that a revoked slug is
 * refused in exactly the words an unknown one is.
 */
describe("Puzzle Links", () => {
  beforeEach(() => {
    links = []
    session = { id: "c1", boardTheme: "green" }
    // The origin a Coach pastes. Read at call time, so a test says what it is
    // rather than inheriting whichever `.env` the run happened to find.
    vi.stubEnv("BETTER_AUTH_URL", "https://learnchess.example")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("mints a whole URL a Coach can paste, on eight unguessable characters", async () => {
    const minted = await mintLink(PUZZLE.id, new Headers())

    // The origin as well as the slug: a Coach pastes this into a chat app,
    // where a bare path opens nothing.
    expect(minted?.url).toMatch(
      /^https:\/\/learnchess\.example\/p\/[0234-9a-hjkmnp-z]{8}$/
    )
  })

  it("opens on the Position and the Goal, and says nothing about whose Puzzle it is", async () => {
    const minted = await mintLink(PUZZLE.id, new Headers())

    const opened = await openLink(slugOf(minted!.url))

    // `toEqual` and not a field-by-field read: an id, a Coach or a timestamp
    // added to this DTO later fails here, which is the point of it.
    expect(opened).toEqual({
      puzzle: {
        name: "Back rank mate",
        fen: "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1",
        goal: { kind: "mate_in", n: 1 },
      },
      boardTheme: "green",
    })
  })

  it("stamps the board the Coach teaches on, so a Student meets the board they were taught on", async () => {
    session = { id: "c1", boardTheme: "brown" }

    const minted = await mintLink(PUZZLE.id, new Headers())

    expect((await openLink(slugOf(minted!.url)))?.boardTheme).toBe("brown")
  })

  it("keeps the board it was stamped with after the Coach moves to another one", async () => {
    session = { id: "c1", boardTheme: "brown" }
    const minted = await mintLink(PUZZLE.id, new Headers())

    // The same Coach, teaching on green from now on. The link they already
    // sent is not repainted under the Student holding it.
    session = { id: "c1", boardTheme: "green" }

    expect((await openLink(slugOf(minted!.url)))?.boardTheme).toBe("brown")
  })

  it("hands back the link already minted rather than a second one to keep track of", async () => {
    const first = await mintLink(PUZZLE.id, new Headers())
    const second = await mintLink(PUZZLE.id, new Headers())

    expect(second).toEqual(first)
    expect(links).toHaveLength(1)
  })

  it("reports no link until one is minted, which is what the Coach's screen reads", async () => {
    expect(await readLink(PUZZLE.id, new Headers())).toBeNull()

    const minted = await mintLink(PUZZLE.id, new Headers())

    expect(await readLink(PUZZLE.id, new Headers())).toEqual(minted)
  })

  it("mints nothing over a Puzzle that is not this Coach's, and reads none of its links", async () => {
    session = { id: "c2", boardTheme: "green" }

    expect(await mintLink(PUZZLE.id, new Headers())).toBeNull()
    expect(await readLink(PUZZLE.id, new Headers())).toBeNull()
    expect(links).toHaveLength(0)
  })

  it("mints nothing without a session, because a link belongs to the Coach who minted it", async () => {
    session = null

    expect(await mintLink(PUZZLE.id, new Headers())).toBeNull()
    expect(links).toHaveLength(0)
  })

  it("refuses a Puzzle id that is not one, rather than handing postgres a string to raise on", async () => {
    expect(await mintLink("not-a-puzzle", new Headers())).toBeNull()
    expect(await readLink("not-a-puzzle", new Headers())).toBeNull()
    await revokeLink("not-a-puzzle", new Headers())

    expect(links).toHaveLength(0)
  })

  it("refuses a revoked slug exactly as it refuses one that never existed, so neither says which Puzzles are real", async () => {
    const minted = await mintLink(PUZZLE.id, new Headers())

    await revokeLink(PUZZLE.id, new Headers())

    expect(await openLink(slugOf(minted!.url))).toBeNull()
    expect(await openLink("zzzzzzzz")).toBeNull()
  })

  it("draws a fresh slug after a revoke, and leaves the revoked one dead behind it", async () => {
    const revoked = await mintLink(PUZZLE.id, new Headers())
    await revokeLink(PUZZLE.id, new Headers())

    const fresh = await mintLink(PUZZLE.id, new Headers())

    expect(fresh!.url).not.toBe(revoked!.url)
    // Minting again is not how a Coach un-revokes: the URL a Student was
    // already sent stays closed.
    expect(await openLink(slugOf(revoked!.url))).toBeNull()
    expect(await openLink(slugOf(fresh!.url))).not.toBeNull()
  })

  it("revokes nothing for a Coach who does not own the Puzzle, so a link outlives a stranger's tap", async () => {
    const minted = await mintLink(PUZZLE.id, new Headers())

    session = { id: "c2", boardTheme: "green" }
    await revokeLink(PUZZLE.id, new Headers())

    expect(await openLink(slugOf(minted!.url))).not.toBeNull()
  })
})
