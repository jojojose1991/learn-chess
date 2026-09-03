import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { stopEngine } from "@/lib/engine/service"
import { Route } from "@/routes/api/engine/move"

import { commandsSent, fakeEngine } from "../../../lib/engine/fake-engine"

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1"

beforeEach(() => {
  // The route takes the think time from the environment, so every test that
  // reaches the engine needs one. Borrowing it from a developer's `.env`
  // leaves the suite red on a fresh clone, where it must need nothing.
  vi.stubEnv("ENGINE_MOVETIME_MS", "10")
})

afterEach(() => {
  stopEngine()
  vi.unstubAllEnvs()
})

// `handlers` is typed as an object or a factory; this route uses the object.
const { POST } = Route.options.server?.handlers as {
  POST: (ctx: { request: Request }) => Promise<Response>
}

/** The route as a client meets it: one POST, a JSON body, a JSON answer. */
const post = (body: string) =>
  POST({
    request: new Request("http://localhost:3000/api/engine/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  })

describe("the engine route", () => {
  it("answers the move as the two squares it is made of, so the client can play it", async () => {
    vi.stubEnv("STOCKFISH_PATH", fakeEngine(`say("bestmove e2e4")`))

    const response = await post(JSON.stringify({ fen: START }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ from: "e2", to: "e4" })
  })

  it.each([
    ["not JSON at all", "surprise"],
    ["JSON that is not an object", '"e2e4"'],
    ["an object with no Position in it", "{}"],
    ["a Position that is not even a string", '{"fen":5}'],
  ])("answers 400 to %s, so the route keeps its one job", async (_, body) => {
    vi.stubEnv("STOCKFISH_PATH", "/nonexistent/stockfish")

    expect((await post(body)).status).toBe(400)
  })

  it("answers 422 with the reason, because an illegal Position is the caller's mistake and not a broken engine", async () => {
    vi.stubEnv("STOCKFISH_PATH", "/nonexistent/stockfish")

    const response = await post(
      JSON.stringify({ fen: "8/8/8/8/8/8/8/8 w - - 0 1" })
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: "White has no king.",
    })
  })

  it("thinks for the server's budget whatever the body asks for, so an unlisted Puzzle Link cannot buy CPU", async () => {
    const engine = fakeEngine(`say("bestmove e2e4")`)
    vi.stubEnv("STOCKFISH_PATH", engine)
    vi.stubEnv("ENGINE_MOVETIME_MS", "37")

    await post(JSON.stringify({ fen: START, movetimeMs: 600_000 }))

    expect(commandsSent(engine)).toContain("go movetime 37")
  })

  it.each([
    ["504", "an engine that stops answering", fakeEngine(``)],
    ["503", "an engine that will not start", "/nonexistent/stockfish"],
    [
      "409",
      "a Position with no move to play",
      fakeEngine(`say("bestmove (none)")`),
    ],
  ])(
    "answers %s to %s, so a caller can tell a slow board from a broken server",
    async (status, _, binary) => {
      vi.stubEnv("STOCKFISH_PATH", binary)

      expect((await post(JSON.stringify({ fen: START }))).status).toBe(
        Number(status)
      )
    }
  )

  it("answers 503 to a caller arriving behind a full queue, so a busy engine is not a broken one", async () => {
    vi.stubEnv("STOCKFISH_PATH", fakeEngine(`say("bestmove e2e4")`))

    const body = JSON.stringify({ fen: START })
    const waiting = Array.from({ length: 8 }, () => post(body))
    const ninth = await post(body)

    expect(ninth.status).toBe(503)
    await expect(ninth.json()).resolves.toEqual({
      error: "The engine is busy. Try again.",
    })
    expect((await Promise.all(waiting)).every((r) => r.status === 200)).toBe(
      true
    )
  })

  /**
   * A server wrong about itself is not the caller's fault and not a retry
   * they can make — and it is still owed the one error shape rather than
   * whatever the framework would have said.
   */
  it("answers 500 in the same error shape when the server is misconfigured", async () => {
    vi.stubEnv("STOCKFISH_PATH", fakeEngine(`say("bestmove e2e4")`))
    vi.stubEnv("ENGINE_MOVETIME_MS", "soon")

    const response = await post(JSON.stringify({ fen: START }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: "The engine's think time is not configured.",
    })
  })
})
