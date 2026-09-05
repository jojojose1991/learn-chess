import { existsSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { applyMove } from "@/lib/chess/rules"
import { bestMove, stopEngine } from "@/lib/engine/service"

import { commandsSent, fakeEngine } from "./fake-engine"

import type { Square } from "chess.js"

// `.env` names this developer's own Stockfish. Read here, at collection time,
// because whether a real engine exists decides whether one test runs at all.
try {
  process.loadEnvFile()
} catch {
  // No `.env`: the environment supplies it, or nothing does.
}

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1"

const installed = process.env.STOCKFISH_PATH
const stockfish = !!installed && existsSync(installed)

// The engine logs, and `log` writes through `console` — so every test gets a
// quiet one, and the tests about the logging read theirs.
beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  // Each test gets its own engine, so a warm one must not survive into the
  // next — and a fake left running would outlive the suite.
  stopEngine()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

/** What `bestMove` answered, as the coordinates a move is made of. */
function played(
  outcome: Awaited<ReturnType<typeof bestMove>>
): [Square, Square] {
  if (!outcome.ok) throw new Error(`no move: ${outcome.failure}`)
  return [outcome.from, outcome.to]
}

/** How many times an engine was introduced, which is once per process. */
const handshakes = (engine: string) =>
  commandsSent(engine).filter((command) => command === "uci").length

/**
 * The engine as the Play loop meets it: a Position in, a move out, and no
 * knowledge of the process behind it. The `go` handler of each fake engine is
 * the far end of a real pipe — what it does to a real search is what
 * Stockfish cannot be asked to do on demand.
 */
describe("bestMove", () => {
  it.skipIf(!stockfish)(
    "returns a move the Position allows, so the Play loop can let the engine defend",
    async () => {
      const outcome = await bestMove(START, 100)

      expect(outcome.ok).toBe(true)
      const [from, to] = played(outcome)
      expect(applyMove(START, from, to).ok).toBe(true)
    }
  )

  it("serves a second request from the same engine, so a Student's second move pays no spawn cost", async () => {
    const engine = fakeEngine(`say("bestmove " + ["e2e4", "d2d4"][n])`)
    vi.stubEnv("STOCKFISH_PATH", engine)

    await bestMove(START, 10)
    await bestMove(START, 10)

    // One introduction, so both moves came from one process.
    expect(handshakes(engine)).toBe(1)
  })

  it("answers overlapping requests one at a time, so no Position is given another's move", async () => {
    const engine = fakeEngine(`say("bestmove " + ["e2e4", "d2d4"][n])`)
    vi.stubEnv("STOCKFISH_PATH", engine)

    const [first, second] = await Promise.all([
      bestMove(START, 10),
      bestMove(START, 10),
    ])

    // One engine, and each request got its own answer from it rather than
    // both being handed the first `bestmove` off the pipe.
    expect(handshakes(engine)).toBe(1)
    expect(played(first)).toEqual(["e2", "e4"])
    expect(played(second)).toEqual(["d2", "d4"])
  })

  it("turns a caller away once the queue is deep, so nobody can hold the one engine", async () => {
    vi.stubEnv("STOCKFISH_PATH", fakeEngine(`say("bestmove e2e4")`))

    // Eight may wait; the ninth is told to come back rather than joining a
    // queue whose tail nobody would wait for.
    const waiting = Array.from({ length: 8 }, () => bestMove(START, 10))
    const ninth = await bestMove(START, 10)

    expect(ninth).toEqual({ ok: false, failure: "busy" })
    expect((await Promise.all(waiting)).every((outcome) => outcome.ok)).toBe(
      true
    )
  })

  it("starts a fresh engine after the last one died, so a crash costs one request and not the route", async () => {
    vi.stubEnv(
      "STOCKFISH_PATH",
      fakeEngine(`if (n === 0) process.exit(1)
       say("bestmove e2e4")`)
    )

    expect(await bestMove(START, 10)).toEqual({
      ok: false,
      failure: "unavailable",
    })
    expect(played(await bestMove(START, 10))).toEqual(["e2", "e4"])
  })

  it("gives up on an engine that stops answering, so a hung search cannot hold a Position open", async () => {
    // Talks UCI, then says nothing at all about the search it was asked for.
    vi.stubEnv("STOCKFISH_PATH", fakeEngine(``))

    expect(await bestMove(START, 10)).toEqual({ ok: false, failure: "timeout" })
  })

  it("does not keep the engine that hung, so the next Position gets a fresh one", async () => {
    const engine = fakeEngine(`if (n === 0) return
       say("bestmove e2e4")`)
    vi.stubEnv("STOCKFISH_PATH", engine)

    await bestMove(START, 10)
    expect(played(await bestMove(START, 10))).toEqual(["e2", "e4"])

    // Two introductions: the engine that went quiet was discarded rather than
    // asked a second question it was never going to answer.
    expect(handshakes(engine)).toBe(2)
  })

  it("refuses an illegal Position, so a board nobody could play never reaches an engine", async () => {
    // Nothing to spawn: if the Position were sent anyway this would be
    // `unavailable` instead.
    vi.stubEnv("STOCKFISH_PATH", "/nonexistent/stockfish")

    expect(await bestMove("8/8/8/8/8/8/8/8 w - - 0 1", 10)).toEqual({
      ok: false,
      failure: "illegal_position",
      reasons: ["White has no king."],
    })
  })

  it("reports that there is no move rather than inventing one", async () => {
    vi.stubEnv("STOCKFISH_PATH", fakeEngine(`say("bestmove (none)")`))

    expect(await bestMove(START, 10)).toEqual({ ok: false, failure: "no_move" })
  })

  it("keeps a promotion a promotion, so a queening reply is not played as a pawn push", async () => {
    vi.stubEnv("STOCKFISH_PATH", fakeEngine(`say("bestmove a7a8q")`))

    expect(await bestMove("k7/P7/8/8/8/8/8/K7 w - - 0 1", 10)).toEqual({
      ok: true,
      from: "a7",
      to: "a8",
      promotion: "q",
    })
  })

  /**
   * `chess.js` splits a FEN on any whitespace, so a newline inside one is a
   * field separator to it and a legal Position can carry one. UCI is
   * line-oriented, and the Position arrives from an unauthenticated request.
   */
  it("sends a Position as one command, so a FEN cannot smuggle a second one", async () => {
    const engine = fakeEngine(`say("bestmove e2e4")`)
    vi.stubEnv("STOCKFISH_PATH", engine)

    await bestMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0\n1", 10)

    expect(commandsSent(engine)).toEqual([
      "uci",
      "isready",
      "position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1",
      "go movetime 10",
    ])
  })

  it("thinks for the server's own budget, so no caller has to name one", async () => {
    const engine = fakeEngine(`say("bestmove e2e4")`)
    vi.stubEnv("STOCKFISH_PATH", engine)
    vi.stubEnv("ENGINE_MOVETIME_MS", "37")

    await bestMove(START)

    expect(commandsSent(engine)).toContain("go movetime 37")
  })

  /**
   * `go movetime NaN` is a search with no limit and a deadline already past,
   * so every request would time out, kill the engine and pay a fresh spawn.
   * A misconfigured server says so instead — and says it as an outcome, so a
   * caller that trusts the return type does not meet an exception.
   */
  // Invalid values, not a missing one: `requireEnv` falls back to reading
  // `.env` itself, so on a machine that has one nothing can prove "unset".
  it.each(["soon", "0", "-1", "99999999999"])(
    "refuses a budget of %j, so a typo is not a 504 forever",
    async (movetime) => {
      vi.stubEnv("STOCKFISH_PATH", fakeEngine(`say("bestmove e2e4")`))
      vi.stubEnv("ENGINE_MOVETIME_MS", movetime)

      expect(await bestMove(START)).toEqual({
        ok: false,
        failure: "misconfigured",
      })
      // On screen it is a 500; the variable to go and fix is only in the log.
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("ENGINE_MOVETIME_MS")
      )
    }
  )

  /**
   * `0000` is UCI's null move and a cut-off line is not a move at all. Either
   * one cast into `{ from, to }` would hand the client coordinates it cannot
   * even reject. Whether a real move is *legal* stays the client's call
   * (ADR-0003).
   */
  it.each(["0000", "e2", "bestmoveish"])(
    "treats %j as no move rather than as squares",
    async (answer) => {
      vi.stubEnv("STOCKFISH_PATH", fakeEngine(`say("bestmove ${answer}")`))

      expect(await bestMove(START, 10)).toEqual({
        ok: false,
        failure: "no_move",
      })
    }
  )

  /**
   * A bad run reads three ways in Cloud Logging, and the level is the whole
   * distinction: slow is a warning, dead is an error, and the replacement
   * that follows either one says so itself.
   *
   * The Position is the only thing off the request that reaches a line, and
   * it is one `validatePosition` accepted. A header, a cookie or a session
   * is not in scope here at all: `bestMove` is handed a FEN and a budget.
   */
  it("names the Position in a warning when a search hangs, so a slow run is not only a symptom on screen", async () => {
    vi.stubEnv("STOCKFISH_PATH", fakeEngine(``))

    expect(await bestMove(START, 10)).toEqual({ ok: false, failure: "timeout" })

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(START))
    // A hang is not a death: killing the engine for one is not it dying.
    expect(console.error).toHaveBeenCalledTimes(0)
  })

  it("logs an error when the engine dies, so a crash does not read as a slow search", async () => {
    vi.stubEnv("STOCKFISH_PATH", fakeEngine(`process.exit(1)`))

    expect(await bestMove(START, 10)).toEqual({
      ok: false,
      failure: "unavailable",
    })

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("stockfish")
    )
    expect(console.warn).toHaveBeenCalledTimes(0)
  })

  it("says a path is not an engine rather than calling it a crash, so a typo is not hunted as one", async () => {
    vi.stubEnv("STOCKFISH_PATH", "/nonexistent/stockfish")

    expect(await bestMove(START, 10)).toEqual({
      ok: false,
      failure: "unavailable",
    })

    // The path itself, which is the thing that is wrong — an engine that
    // died and one that never existed are not the same page to open.
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("/nonexistent/stockfish")
    )
  })

  /**
   * A FEN can carry a newline and still be legal (see the command-splitting
   * test above), and it arrives from an unauthenticated request — so a line
   * of ours is not somewhere a caller gets to write a line of their own.
   */
  it("keeps a warning to one line, so a Position cannot forge a second log entry", async () => {
    vi.stubEnv("STOCKFISH_PATH", fakeEngine(``))

    await bestMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0\n1", 10)

    expect(console.warn).toHaveBeenCalledWith(expect.not.stringContaining("\n"))
  })

  it("logs every engine it starts, so a respawn loop is visible and not just one slow request", async () => {
    vi.stubEnv(
      "STOCKFISH_PATH",
      fakeEngine(`if (n === 0) process.exit(1)
       say("bestmove e2e4")`)
    )

    await bestMove(START, 10)
    await bestMove(START, 10)

    // Two starts, two lines, at a level neither the hang nor the death uses.
    expect(console.info).toHaveBeenCalledTimes(2)
    expect(console.warn).toHaveBeenCalledTimes(0)
  })
})
