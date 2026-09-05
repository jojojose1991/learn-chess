import { readFileSync, readdirSync } from "node:fs"
import { crc32, deflateSync } from "node:zlib"
import { createRequire } from "node:module"
import { dirname } from "node:path"
import { PNG } from "pngjs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { seenFrom } from "@/lib/scan/service"

import { KEYSTONE, outBy } from "../../fixtures/keystone"

import type * as auth from "@/lib/auth"
import type { Quad } from "@/lib/scan/rules"

/** The board every fixture is a screenshot of, as the classifier should read it. */
const POSITION = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR"

/** The same board mirrored: what a screenshot taken from Black's side reads as. */
const MIRRORED = "RN1K1BNR/PPP1PPPP/2Q5/3P1B2/3p4/2n2n2/ppp1pppp/r1bkqb1r"

const fixture = (name: string, format: "png" | "jpg" = "png") =>
  readFileSync(new URL(`../../fixtures/${name}.${format}`, import.meta.url))

/**
 * An image on demand. The service takes the body as a thunk, not as bytes, so
 * that it reads the session before it reads megabytes of a shared container's
 * memory — these tests say which of the two happened by whether this ran.
 */
const supplying = (image: Uint8Array) => () => Promise.resolve(image)

/**
 * Signed in, because a Scan is a Coach's own. Only the session is faked: the
 * classifier, the model and the decoders are the things under test.
 */
function asCoach(coach: { id: string } | null = { id: "c1" }) {
  vi.doMock("@/lib/auth", async (importOriginal) => ({
    ...(await importOriginal<typeof auth>()),
    getCoach: async () => coach,
  }))
  return import("@/lib/scan/service")
}

beforeEach(() => vi.resetModules())
afterEach(() => vi.doUnmock("@/lib/auth"))

/**
 * Each test re-imports the service under `resetModules`, so each pays its own
 * `InferenceSession.create` — 65-83 ms, plus a full board recognition. Slowest
 * measured 2.6 s with the machine moderately busy and over 5 s with three
 * builds sharing it, which is what vitest's default budget is for a pure
 * function rather than for this.
 */
vi.setConfig({ testTimeout: 15_000 })

describe("scanning an image of a board", () => {
  it("reads every square of a clean screenshot, so a Coach confirms a Position rather than builds one", async () => {
    const { scan } = await asCoach()

    const outcome = await scan(supplying(fixture("board-white")), new Headers())

    expect(outcome).toMatchObject({
      ok: true,
      scan: { placement: POSITION, reliable: true },
    })
  })

  it("reads the same board out of a JPEG, because a screenshot shared through a phone stops being a PNG", async () => {
    const { scan } = await asCoach()

    const outcome = await scan(
      supplying(fixture("board-white", "jpg")),
      new Headers()
    )

    expect(outcome).toMatchObject({
      ok: true,
      scan: { placement: POSITION, reliable: true },
    })
  })

  it("says how sure it is of the worst square as well as the average, because one wrong square is what a bad read looks like", async () => {
    const { scan } = await asCoach()

    const outcome = await scan(supplying(fixture("board-white")), new Headers())

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.scan.minConfidence).toBeGreaterThan(0.7)
    expect(outcome.scan.minConfidence).toBeLessThanOrEqual(
      outcome.scan.meanConfidence
    )
  })

  it("hands back the placement the classifier saw when the board was screenshotted from Black's side, so nothing is silently rotated", async () => {
    const { scan } = await asCoach()

    const outcome = await scan(supplying(fixture("board-black")), new Headers())

    // The mirror, not the upright Position: the transform is the Coach's to
    // make from the suggestion, never the pipeline's (ADR-0002).
    expect(outcome).toMatchObject({
      ok: true,
      scan: { placement: MIRRORED, reliable: true, seenFrom: "black" },
    })
  })

  it("calls a board three degrees off square unreliable rather than presenting a bad draft as good", async () => {
    const { scan } = await asCoach()

    const outcome = await scan(supplying(fixture("board-askew")), new Headers())

    expect(outcome).toMatchObject({ ok: true, scan: { reliable: false } })
  })

  it("refuses a Coach who is not signed in without reading their upload at all, so a stranger cannot spend the container's memory", async () => {
    const { scan } = await asCoach(null)

    // A body that would throw if it were ever asked for: who is calling is
    // the cheapest refusal there is, so it has to come first.
    const outcome = await scan(() => {
      throw new Error("the body was read before the session")
    }, new Headers())

    expect(outcome).toEqual({ ok: false, failure: "unauthenticated" })
  })
})

/**
 * The recovery path. A photograph defeats the detector, which follows whole
 * rows and columns and so has a rotation tolerance under a degree — but the
 * classifier was never the half that failed (ADR-0002), and four corners plus
 * our own warp hand it a square board to read.
 */
describe("scanning a board a Coach has put four corners on", () => {
  it("reads every square of a board seen from off to one side, which is the whole reason the four corners exist", async () => {
    const { scan } = await asCoach()

    const outcome = await scan(
      supplying(fixture("board-keystone", "jpg")),
      new Headers(),
      KEYSTONE.corners
    )

    expect(outcome).toMatchObject({
      ok: true,
      scan: { placement: POSITION, reliable: true },
    })
    // Measured 0.915 — higher than any clean screenshot in this suite.
    expect(outcome.ok && outcome.scan.minConfidence).toBeGreaterThan(0.9)
  })

  it("cannot read the same image on its own, so the four corners are a recovery and not a preference", async () => {
    const { scan } = await asCoach()

    const outcome = await scan(
      supplying(fixture("board-keystone", "jpg")),
      new Headers()
    )

    // Not a bad read — no read. The detector follows whole rows and columns
    // and a keystone has none, so there is nothing for it to lock onto.
    expect(outcome).toEqual({ ok: false, failure: "no_board" })
  })

  it("loses its confidence when every corner is 25px out on both axes, which is what makes a warning about them possible", async () => {
    const { scan } = await asCoach()

    const outcome = await scan(
      supplying(fixture("board-keystone", "jpg")),
      new Headers(),
      outBy(25)
    )

    // Measured 0.239 against 0.915 for the same picture placed properly.
    // Minimum confidence collapses well before accuracy does, which is what
    // makes it an early warning rather than a report of a wrong Position.
    expect(outcome).toMatchObject({ ok: true, scan: { reliable: false } })
    expect(outcome.ok && outcome.scan.minConfidence).toBeLessThan(0.5)
  })

  it("says there is no board rather than a confidently empty one when the corners bound almost nothing", async () => {
    const { scan } = await asCoach()
    // Convex, clockwise, and every point on the picture, so the warp takes
    // it — and one flat colour blown up to 256 square reads as sixty-four
    // empty squares at 0.95. That is the one wrong answer the confidence
    // floor cannot catch, which is why the detector refuses an empty read on
    // the other path and this one has to say the same thing.
    const sliver: Quad = [
      { x: 400, y: 400 },
      { x: 401, y: 400 },
      { x: 401, y: 401 },
      { x: 400, y: 401 },
    ]

    const outcome = await scan(
      supplying(fixture("board-keystone", "jpg")),
      new Headers(),
      sliver
    )

    expect(outcome).toEqual({ ok: false, failure: "no_board" })
  })

  it("refuses four corners that are not four corners of anything rather than warping a board out of them", async () => {
    const { scan } = await asCoach()
    const collapsed = KEYSTONE.corners.map(() => ({ x: 10, y: 10 })) as Quad

    const outcome = await scan(
      supplying(fixture("board-keystone", "jpg")),
      new Headers(),
      collapsed
    )

    expect(outcome).toEqual({ ok: false, failure: "bad_corners" })
  })
})

describe("what a Scan refuses to even decode", () => {
  it("refuses a file that is not an image, because the decoder is the last place to meet an untrusted file", async () => {
    const { scan } = await asCoach()

    const outcome = await scan(
      supplying(Buffer.from("#!/bin/sh\nrm -rf /\n")),
      new Headers()
    )

    expect(outcome).toEqual({ ok: false, failure: "not_an_image" })
  })

  it("passes on an upload that outran its cap rather than decoding what arrived of it", async () => {
    const { scan } = await asCoach()

    const outcome = await scan(
      () => Promise.resolve("too_large"),
      new Headers()
    )

    expect(outcome).toEqual({ ok: false, failure: "too_large" })
  })

  it("refuses an interlaced PNG unread, because pngjs inflates those with no ceiling and a 300 kB file takes 96 MB", async () => {
    const { scan } = await asCoach()
    // Declares itself 1x1 and interlaced, with 300 MB of zeros behind it.
    // pngjs bounds its ordinary inflate by the declared image size and its
    // Adam7 one by nothing at all, so this is the shape that gets past a
    // dimension check and takes the container with it.
    const bomb = interlacedBomb()
    const before = process.memoryUsage().rss

    const outcome = await scan(supplying(bomb), new Headers())

    expect(outcome).toEqual({ ok: false, failure: "unreadable" })
    // The assertion that matters: refused, and refused without paying for it.
    const spent = (process.memoryUsage().rss - before) / 1024 / 1024
    expect(spent).toBeLessThan(40)
  })

  it("refuses a PNG whose header claims more pixels than the server will hold, so a small file cannot ask for a large allocation", async () => {
    const { scan } = await asCoach()
    // A real header, rewritten to claim 30000 x 30000 — 3.6 GB of RGBA out of
    // a file that is a few kilobytes on the wire.
    const bomb = Buffer.from(fixture("board-white"))
    bomb.writeUInt32BE(30_000, 16)
    bomb.writeUInt32BE(30_000, 20)

    const outcome = await scan(supplying(bomb), new Headers())

    expect(outcome).toEqual({ ok: false, failure: "too_many_pixels" })
  })

  it("says there is no board in an image with nothing in it, rather than answering with a placement", async () => {
    const { scan } = await asCoach()
    const blank = new PNG({ width: 400, height: 400 })
    blank.data.fill(200)

    const outcome = await scan(supplying(PNG.sync.write(blank)), new Headers())

    expect(outcome).toEqual({ ok: false, failure: "no_board" })
  })

  it("refuses an image it cannot decode rather than throwing out of the route", async () => {
    const { scan } = await asCoach()
    const truncated = fixture("board-white").subarray(0, 400)

    const outcome = await scan(supplying(truncated), new Headers())

    expect(outcome).toEqual({ ok: false, failure: "unreadable" })
  })
})

/**
 * `onnxruntime-node`'s postinstall downloads CUDA and TensorRT execution
 * providers from nuget.org — hundreds of megabytes of GPU code for a
 * classifier that is 1.3 MB and runs on a CPU. pnpm blocks a build script
 * unless `pnpm-workspace.yaml` allows it, and the Dockerfile sets
 * `ONNXRUNTIME_NODE_INSTALL=skip` besides; this is what goes red if either
 * ever changes.
 */
describe("what the classifier costs to install", () => {
  it("leaves onnxruntime-node's build script blocked, because its postinstall downloads CUDA and TensorRT providers nothing here runs", () => {
    const workspace = readFileSync(
      new URL("../../../pnpm-workspace.yaml", import.meta.url),
      "utf8"
    )

    // Said out loud rather than left absent, the way `msw: false` is: an
    // absence is what `pnpm approve-builds` fills in without anyone noticing.
    expect(workspace).toMatch(/^\s+onnxruntime-node:\s*false\s*$/m)
  })

  it("has no GPU execution providers on disk, because the image pays for whatever is in the tree", () => {
    const root = dirname(
      createRequire(import.meta.url).resolve("onnxruntime-node/package.json")
    )

    const downloaded = readdirSync(root, { recursive: true })
      .map(String)
      .filter((file) => /cuda|tensorrt/i.test(file))

    expect(downloaded).toEqual([])
  })
})

/**
 * `resolveOrientation` infers which side a board was seen from by comparing
 * how far each side's pawns have advanced. Composed mate-in-N puzzles are
 * exactly the content that breaks it, so the suggestion is bounded here
 * (ADR-0002) and never applied.
 */
describe("which side the board was seen from", () => {
  it("says Black for a board whose pawns are marching the wrong way, which is the one thing pixels can tell", () => {
    expect(seenFrom(MIRRORED)).toBe("black")
    expect(seenFrom(POSITION)).toBe("white")
  })

  it("says nothing at all when either side has fewer than three pawns, because a mate-in-1 with two pawns rotated a perfect read by 180 degrees", () => {
    // The measured case: white's pawns on e7 and f6 are further advanced than
    // black's on h5, so the heuristic calls an upright board flipped.
    expect(seenFrom("4k3/4P3/4KP2/7p/8/8/8/8")).toBeNull()
  })

  it("says nothing about a board with no pawns on it, where advancement is not a signal at all", () => {
    expect(seenFrom("4k3/8/8/8/8/8/8/4K2R")).toBeNull()
  })
})

/**
 * A PNG that declares itself 1×1 and interlaced, with 300 MB of zeros
 * compressed behind it — a few hundred kilobytes on the wire. Hand-built
 * because no encoder here writes one, and the header is the whole point:
 * everything a decoder allocates, it allocates on this file's say-so.
 */
function interlacedBomb() {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, "ascii"), data])
    const checksum = Buffer.alloc(4)
    checksum.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([length, body, checksum])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0) // width
  ihdr.writeUInt32BE(1, 4) // height
  ihdr.writeUInt8(8, 8) // bit depth
  ihdr.writeUInt8(6, 9) // colour type: RGBA
  ihdr.writeUInt8(1, 12) // interlace method: Adam7

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.alloc(300 * 1024 * 1024))),
    chunk("IEND", Buffer.alloc(0)),
  ])
}
