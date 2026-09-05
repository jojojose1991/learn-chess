import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as auth from "@/lib/auth"

const POSITION = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR"

const fixture = (name: string) =>
  readFileSync(new URL(`../../fixtures/${name}.png`, import.meta.url))

/** The handler as a client meets it: one POST, the image as the body. */
type Handler = (ctx: { request: Request }) => Promise<Response>

/**
 * Signed in, with the real classifier behind it. Only the session is faked —
 * the route's job is to say what the answer was, and a mocked pipeline would
 * leave it saying it about nothing.
 */
async function route(coach: { id: string } | null = { id: "c1" }) {
  vi.doMock("@/lib/auth", async (importOriginal) => ({
    ...(await importOriginal<typeof auth>()),
    getCoach: async () => coach,
  }))
  const { Route } = await import("@/routes/api/scan")
  const { POST } = Route.options.server?.handlers as { POST: Handler }

  return (body: BodyInit, headers: HeadersInit = {}) =>
    POST({
      request: new Request("http://localhost:3000/api/scan", {
        method: "POST",
        headers,
        body,
        // A stream body has no length, which `fetch` requires this to say.
        ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
      }),
    })
}

beforeEach(() => vi.resetModules())
afterEach(() => vi.doUnmock("@/lib/auth"))

describe("the scan route", () => {
  it("answers the placement it read and how sure it is, which is everything a draft needs", async () => {
    const post = await route()

    const response = await post(fixture("board-white"))

    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      placement: POSITION,
      reliable: true,
      seenFrom: "white",
    })
    expect(body.minConfidence).toBeGreaterThan(0.7)
    expect(body.meanConfidence).toBeGreaterThan(0.7)
  })

  it("answers an unreliable read as an answer rather than an error, because the Coach still has to be told what it saw", async () => {
    const post = await route()

    const response = await post(fixture("board-askew"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ reliable: false })
  })

  it("answers 401 to a caller with no session, so scanning is a Coach's own and not the internet's", async () => {
    const post = await route(null)

    const response = await post(fixture("board-white"))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Sign in to scan an image.",
    })
  })

  it("answers 413 to a body past the cap even when nothing declared its length, so an unbounded upload is not buffered", async () => {
    const post = await route()
    // A megabyte at a time, forever: no content-length to read, and nothing
    // but a counted read stops this filling the container's memory.
    const endless = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024))
      },
    })

    const response = await post(endless)

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({
      error: "That image is too large. 12 megabytes is the most.",
    })
  })

  /**
   * One status a kind of wrong, so a caller can tell their own bad file from
   * our bad server. Which files are which is the service's own test; that
   * each arrives as this envelope and this number is the route's.
   */
  it.each([
    [415, "a file that is not an image", "#!/bin/sh\nrm -rf /\n"],
    [415, "no body at all", ""],
    [
      422,
      "an image that cannot be decoded",
      fixture("board-white").subarray(0, 400),
    ],
  ])("answers %s to %s, in the one error shape", async (status, _, body) => {
    const post = await route()

    const response = await post(body)

    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toEqual({
      error: expect.any(String),
    })
  })
})
