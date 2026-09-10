import { describe, expect, it } from "vitest"

import { LADDER, readByVote, shrink } from "@/lib/scan/ladder"

import type { GrayImage, RecognitionResult } from "@scoriiu/fenshot"

/**
 * Why downscaling deskews is `src/lib/scan/ladder.ts`'s own header. What each
 * rung reads here is the injected classifier's answer, which is what makes a
 * vote testable without a photograph: the seam is fenshot's own — it takes a
 * classifier for exactly this reason — and the image below is only there to
 * give the detector a grid to find at every rung.
 */

/** A bare eight-by-eight grid on a paper-coloured page, at `side` pixels square. */
function grid(side: number): GrayImage {
  const tile = Math.floor((side * 0.8) / 8)
  const margin = (side - tile * 8) / 2
  const data = new Float32Array(side * side)
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const file = Math.floor((x - margin) / tile)
      const rank = Math.floor((y - margin) / tile)
      const dark =
        file >= 0 &&
        file < 8 &&
        rank >= 0 &&
        rank < 8 &&
        (file + rank) % 2 === 1
      data[y * side + x] = dark ? 90 : 232
    }
  }
  return { data, width: side, height: side }
}

/**
 * A classifier that answers by the size of the picture it is handed, so a test
 * can say what each rung of the ladder reads. Confidence rides along with the
 * answer, because the whole question is which of the two signals wins.
 */
const answering =
  (
    reads: Array<{ from: number; placement: string; confidence: number }>
  ): ((image: GrayImage, corners: unknown) => Promise<RecognitionResult>) =>
  (image) => {
    const read = reads.find(({ from }) => image.width >= from)
    if (!read) throw new Error(`nothing to read at ${image.width}px`)
    return Promise.resolve({
      placement: read.placement,
      confidences: Array(64).fill(read.confidence) as Array<number>,
      minConfidence: read.confidence,
      meanConfidence: read.confidence,
    })
  }

/**
 * As many placements as there are rungs, all different and none of them
 * empty: the black king walks along a rank and then drops onto the next.
 */
const kingOn = (at: number) => {
  const file = at % 8
  const rank = `${file || ""}k${7 - file || ""}`
  return at < 8 ? `${rank}/8/8/8/8/8/8/4K3` : `8/${rank}/8/8/8/8/8/4K3`
}
const ONE = kingOn(4)
const OTHER = kingOn(5)

describe("reading a board over a ladder of downscales", () => {
  it("keeps the placement the most scales agree on, so agreement outranks however sure of itself a single scale was", async () => {
    // The measured case: a photograph read one square off at 900 px was
    // classified at 0.94 and called itself reliable, while the two scales that
    // read it exactly were both under 0.4. No other scale agrees with a grid
    // that is one square out, and that is the only thing that separates them.
    const read = await readByVote(
      grid(1000),
      answering([
        { from: 900, placement: OTHER, confidence: 0.99 },
        { from: 0, placement: ONE, confidence: 0.75 },
      ])
    )

    expect(read?.placement).toBe(ONE)
  })

  it("says how many scales agreed, because that is the signal minimum confidence cannot carry", async () => {
    // Bigger than the top rung, so every rung is a picture of its own and the
    // count is the whole ladder.
    const read = await readByVote(
      grid(1700),
      answering([{ from: 0, placement: ONE, confidence: 0.9 }])
    )

    expect(read?.agreement).toBe(LADDER.length)
    expect(read?.reliable).toBe(true)
  })

  it("counts the pictures it looked at and not the rungs it was asked for, because a screenshot is already smaller than the top of the ladder", async () => {
    // Every fixture in this repo is 860px on its long edge, where the top
    // four rungs are all `shrink`'s untouched original — the same picture,
    // read four times. Counted as four agreeing scales, two of them alone
    // clear `AGREEING_SCALES`, so a grid found one square off in a screenshot
    // would call itself reliable on nothing but its own repetition.
    const read = await readByVote(
      grid(860),
      answering([{ from: 0, placement: ONE, confidence: 0.9 }])
    )

    // 860, 800, 700, 600, 500 and 400: six distinct pictures out of nine rungs.
    expect(read?.agreement).toBe(6)
  })

  it("trusts nothing when two placements are read by as many scales as each other, because the tie is broken by the one signal known to be inverted", async () => {
    // Four rungs each. Confidence would hand it to the first, and the measured
    // case is that a grid one square out is the confident one: 0.94 against
    // the correct read's 0.36 and 0.30 (docs/learnings/board-recognition.md).
    const read = await readByVote(
      grid(1700),
      answering([
        { from: 900, placement: OTHER, confidence: 0.99 },
        { from: 500, placement: ONE, confidence: 0.5 },
        { from: 0, placement: kingOn(2), confidence: 0.4 },
      ])
    )

    expect(read?.reliable).toBe(false)
  })

  it("lets a board two scales read stand over an empty one five of them read, because sixty-four empty squares is not a candidate", async () => {
    // An empty square classifies at about 0.95, so empty reads arrive with
    // the highest confidence on the ladder and outvote a real board on a
    // sparse composed endgame — which is this app's whole content. Losing
    // that vote costs the Coach the placement two scales agreed on exactly.
    const read = await readByVote(
      grid(1700),
      answering([
        { from: 700, placement: "8/8/8/8/8/8/8/8", confidence: 0.95 },
        { from: 0, placement: ONE, confidence: 0.62 },
      ])
    )

    expect(read?.placement).toBe(ONE)
  })

  it("reports the worst square of every scale that agreed, not the worst of the kindest of them", async () => {
    // `minConfidence` reaches a Coach as the warning on the draft, so the
    // most flattering of the agreeing looks is the wrong one to quote: one
    // rung at 0.95 would hide five that were barely sure of a square.
    const read = await readByVote(
      grid(1700),
      answering([
        { from: 1200, placement: ONE, confidence: 0.95 },
        { from: 0, placement: ONE, confidence: 0.3 },
      ])
    )

    expect(read?.minConfidence).toBe(0.3)
  })

  it("calls a read no other scale agrees with untrustworthy, however sure of every square it was", async () => {
    // Each rung reads something different, all of them confidently — which is
    // what a grid found in the wrong place looks like from the inside. Bigger
    // than the top rung, so that no two rungs are handed the same picture.
    const read = await readByVote(
      grid(1700),
      answering(
        LADDER.map((from, at) => ({
          from,
          placement: kingOn(at),
          confidence: 0.99 - at / 1000,
        }))
      )
    )

    expect(read?.agreement).toBe(1)
    expect(read?.reliable).toBe(false)
  })

  it("finds no board at all in a picture that has none, rather than answering with a placement", async () => {
    const blank: GrayImage = {
      data: new Float32Array(400 * 400).fill(200),
      width: 400,
      height: 400,
    }

    expect(
      await readByVote(
        blank,
        answering([{ from: 0, placement: ONE, confidence: 0.99 }])
      )
    ).toBeNull()
  })
})

describe("shrinking a picture to a rung of the ladder", () => {
  it("brings the long edge down to the rung, which is what turns a degree of roll into pixels the detector forgives", () => {
    const shrunk = shrink(grid(1000), 500)

    expect([shrunk.width, shrunk.height]).toEqual([500, 500])
  })

  it("hands back a picture already smaller than the rung untouched, so a screenshot is not blurred for nothing", () => {
    const small = grid(300)

    expect(shrink(small, 500)).toBe(small)
  })

  it("averages across a band that does not divide evenly, which is every rung of a real photograph", () => {
    // 3 pixels to 2: each output pixel is the mean of an overlapping pair
    // rather than of a clean half, and neither band may come out empty.
    const three: GrayImage = {
      data: Float32Array.from([0, 90, 180]),
      width: 3,
      height: 1,
    }

    expect([...shrink(three, 2).data]).toEqual([45, 135])
  })

  it("averages the pixels it drops rather than sampling one of them, so a hatched dark square stays dark", () => {
    // Alternating black and white columns: every output pixel is the mean of
    // the ones behind it, so a picture of pure contrast comes back mid-grey.
    // Point sampling would answer 0 or 255 and read as a board of one colour.
    const striped: GrayImage = {
      data: Float32Array.from({ length: 64 }, (_, at) =>
        at % 2 === 0 ? 0 : 255
      ),
      width: 8,
      height: 8,
    }

    const shrunk = shrink(striped, 4)

    expect([...shrunk.data]).toEqual(Array(16).fill(127.5))
  })
})
