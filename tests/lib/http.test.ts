import { describe, expect, it } from "vitest"

import { readBounded } from "@/lib/http"

const CAP = 1_024

/** A request whose body is exactly these chunks, and no declared length. */
const streaming = (chunks: Array<Uint8Array>) =>
  new Request("http://localhost/anything", {
    method: "POST",
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk)
        controller.close()
      },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" })

const bytes = (count: number) => new Uint8Array(count)

describe("reading a request body under a cap", () => {
  it("counts the whole body and not each chunk, so a body split small enough cannot walk past the cap", async () => {
    // Each of these is comfortably under the cap; together they are over it.
    const outcome = await readBounded(
      streaming([bytes(400), bytes(400), bytes(400)]),
      CAP
    )

    expect(outcome).toBe("too_large")
  })

  it.each([
    [CAP, "accepts"],
    [CAP - 1, "accepts"],
  ])(
    "%i bytes is within a cap of 1024, so an honest caller at the limit is served",
    async (size) => {
      const outcome = await readBounded(streaming([bytes(size)]), CAP)

      expect(outcome).not.toBe("too_large")
      expect(outcome).toHaveLength(size)
    }
  )

  it("refuses the first byte past the cap, so the limit is the number it says it is", async () => {
    const outcome = await readBounded(streaming([bytes(CAP + 1)]), CAP)

    expect(outcome).toBe("too_large")
  })

  /**
   * The property the cap exists for. A body read whole and measured
   * afterwards would answer this identically and still have held every byte,
   * so a body with no end is the only thing that tells the two apart.
   */
  it("refuses a body that never ends without waiting for it to, so an unbounded upload is never held", async () => {
    const endless = new Request("http://localhost/anything", {
      method: "POST",
      body: new ReadableStream({
        pull(controller) {
          controller.enqueue(bytes(512))
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" })

    expect(await readBounded(endless, CAP)).toBe("too_large")
  })

  it("stops pulling once it has refused, so the bytes it declined are never read", async () => {
    let pulls = 0
    const counted = new Request("http://localhost/anything", {
      method: "POST",
      body: new ReadableStream({
        pull(controller) {
          pulls++
          controller.enqueue(bytes(512))
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" })

    await readBounded(counted, CAP)
    const whenRefused = pulls
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Not a count: a stream reads a chunk ahead of whoever is asking, so how
    // many it took to cross the cap is the platform's business. That it takes
    // no more of them afterwards is the rule.
    expect(pulls).toBe(whenRefused)
  })

  it("reads a body that arrives in pieces back as the bytes that were sent, so a value split across chunks survives", async () => {
    const sent = new TextEncoder().encode("a Position, in two halves")
    const split = [sent.slice(0, 10), sent.slice(10)]

    const outcome = await readBounded(streaming(split), CAP)

    expect(outcome).toEqual(sent)
  })

  it("reads a request with no body at all as no bytes, so a caller who sent nothing is told what is wrong and not that it was too big", async () => {
    const outcome = await readBounded(
      new Request("http://localhost/anything", { method: "POST" }),
      CAP
    )

    expect(outcome).toEqual(new Uint8Array())
  })
})
