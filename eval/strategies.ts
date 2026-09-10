/**
 * The two ports the eval compares, and every implementation of each.
 *
 * A `Reader` turns a photograph into a placement; a `Sider` turns a placement
 * into the side the board was drawn from. They are separate because they fail
 * separately — a perfect read of a board seen from Black is still a Position
 * nobody can play, and a correct orientation over a garbled read is worth
 * nothing. Scoring them apart is what says which half to work on.
 *
 * This is eval code and does not ship. Production runs exactly one of each,
 * and the point of a port here is that a candidate can be measured beside the
 * incumbent before it replaces one.
 */

import { recognizeGray, resolveOrientation } from "@scoriiu/fenshot"

import { LADDER, readByVote, shrink } from "@/lib/scan/ladder"
import { seenFrom } from "@/lib/scan/service"

import type { Classify } from "@/lib/scan/ladder"

import type { GrayImage } from "@scoriiu/fenshot"

/** What one look at a photograph produced. */
export type Read = {
  /** The FEN placement field, as the classifier saw it — never rotated. */
  placement: string
  minConfidence: number
  /**
   * How many independent looks agreed on this placement, where the reader
   * took more than one. A reader that looks once says 1.
   */
  agreement: number
}

/** A way from a photograph to a placement. `null` is "no board in this". */
export type Reader = {
  name: string
  read: (image: GrayImage) => Promise<Read | null>
}

/** A way from a placement to the side the board was drawn from. */
export type Sider = {
  name: string
  /** `null` is "these pixels cannot say", which is a better answer than a guess. */
  seenFrom: (placement: string) => "white" | "black" | null
}

export type { Classify }

export function readers(classify: Classify): Array<Reader> {
  return [
    // The whole frame, no preparation at all — what shipped before the
    // ladder, kept as the baseline every rung is read against.
    //
    // The `s*`/`c*` baselines below are generated from the incumbent's own
    // `LADDER`, so trimming that array in `src/` rewrites this baseline set
    // and the result keys `eval/results/` is indexed by. Trim it and the
    // historical tables stop lining up.
    { name: "full", read: once(classify, (image) => image) },

    ...LADDER.map((size) => ({
      name: `s${size}`,
      read: once(classify, (image) => shrink(image, size)),
    })),
    ...LADDER.map((size) => ({
      name: `c${size}`,
      read: once(classify, (image) => stretch(shrink(image, size))),
    })),

    // The incumbent, imported rather than restated: an eval scoring its own
    // copy stops measuring what ships the moment one of them is edited.
    { name: "vote", read: (image) => readByVote(image, classify) },
    // The same vote over a stretched frame — a different strategy from the
    // retired `vote-c`, which stretched each rung after shrinking it, and
    // named differently so the record does not read as a regression of one
    // thing. Measured worse than `vote`: the stretch is a small-image tool.
    { name: "c-vote", read: (image) => readByVote(stretch(image), classify) },
  ]
}

export const siders: Array<Sider> = [
  // What ships, imported rather than restated: an eval scoring its own copy
  // of the incumbent stops measuring the incumbent the moment one of them is
  // edited. The side whose king stands in the near half.
  { name: "kings", seenFrom },
  // The retired one, kept so the comparison that retired it stays readable:
  // fenshot's own, which reads pawn advancement and so declines on exactly
  // the composed endgames this app is for. `resolveOrientation` answers
  // "white" when it means "I cannot tell", hence the guard.
  {
    name: "pawns",
    seenFrom: (placement) => {
      const pawns = (side: string) =>
        [...placement].filter((piece) => piece === side).length
      if (pawns("P") < 3 || pawns("p") < 3) return null
      return resolveOrientation(placement).orientation
    },
  },
]

/** A reader that looks once, at whatever `prepare` hands it. */
function once(classify: Classify, prepare: (image: GrayImage) => GrayImage) {
  return async (image: GrayImage) => {
    const prepared = prepare(image)
    const read = await recognizeGray(prepared, (corners) =>
      classify(prepared, corners)
    )
    return read ? { ...read, agreement: 1 } : null
  }
}

/**
 * The same picture with its ink and its paper pulled to the ends of the range.
 *
 * A book diagram under room light is mid-grey on off-white, and there is no
 * normalisation at inference (docs/learnings/board-recognition.md), so the
 * whole histogram arrives inside the middle third of the one the model was
 * trained on. Percentiles rather than the extremes, because otherwise one
 * specular highlight is the entire ceiling.
 */
export function stretch(image: GrayImage): GrayImage {
  const histogram = new Uint32Array(256)
  for (const value of image.data) {
    histogram[Math.max(0, Math.min(255, value | 0))]++
  }

  const edge = image.data.length * 0.02
  let seen = 0
  let low = 0
  let high = 255
  for (let value = 0; value < 256; value++) {
    seen += histogram[value]
    if (seen > edge) {
      low = value
      break
    }
  }
  seen = 0
  for (let value = 255; value >= 0; value--) {
    seen += histogram[value]
    if (seen > edge) {
      high = value
      break
    }
  }
  if (high - low < 16) return image

  const scale = 255 / (high - low)
  const data = new Float32Array(image.data.length)
  for (let at = 0; at < data.length; at++) {
    data[at] = Math.max(0, Math.min(255, (image.data[at] - low) * scale))
  }
  return { data, width: image.width, height: image.height }
}
