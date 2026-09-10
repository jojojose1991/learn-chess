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

import { recognizeGray } from "@scoriiu/fenshot"

import { seenFrom } from "@/lib/scan/service"

import type {
  BoardCorners,
  GrayImage,
  RecognitionResult,
} from "@scoriiu/fenshot"

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

/** The model's own input and output: 64 tiles in, a placement out. */
export type Classify = (
  image: GrayImage,
  corners: BoardCorners
) => Promise<RecognitionResult>

/**
 * The long edges a reader is allowed to look at.
 *
 * The detector follows whole rows and columns and accepts a grid line within
 * five *pixels*, so a degree of roll smears one over `width · sin θ` — 52 px
 * at 3000 and 9 px at 500. Its rotation tolerance is therefore a property of
 * the image's size and not of the photograph, and downscaling is the only
 * deskew knob there is.
 */
export const LADDER = [1600, 1200, 1000, 900, 800, 700, 600, 500, 400]

export function readers(classify: Classify): Array<Reader> {
  return [
    // What ships today: the full frame, no preparation at all.
    { name: "full", read: once(classify, (image) => image) },

    ...LADDER.map((size) => ({
      name: `s${size}`,
      read: once(classify, (image) => shrink(image, size)),
    })),
    ...LADDER.map((size) => ({
      name: `c${size}`,
      read: once(classify, (image) => stretch(shrink(image, size))),
    })),

    { name: "vote", read: voting(classify, (image) => image) },
    { name: "vote-c", read: voting(classify, stretch) },
  ]
}

export const siders: Array<Sider> = [
  // What ships today, imported rather than restated: an eval scoring its own
  // copy of the incumbent stops measuring the incumbent the moment one of
  // them is edited.
  { name: "pawns", seenFrom },
  // The candidate: the side whose king stands in the near half is the side
  // the board was drawn from. A king is on every board, which is the whole
  // argument — pawn advancement declines on exactly the composed endgames
  // this app is for.
  {
    name: "kings",
    seenFrom: (placement) => {
      const ranks = placement.split("/")
      // Exactly one of each, because a misread board can carry two of a
      // colour and `findIndex` would answer confidently off whichever came
      // first. Declining is the whole contract of returning null.
      const at = (king: string) => {
        const on = ranks.flatMap((rank, index) =>
          [...rank].filter((piece) => piece === king).map(() => index)
        )
        return on.length === 1 ? on[0] : -1
      }
      const white = at("K")
      const black = at("k")
      if (white < 0 || black < 0 || white === black) return null
      // Ranks run 8 down to 1, so an index of 4 or more is the near half.
      return white >= 4 && black < 4
        ? "white"
        : black >= 4 && white < 4
          ? "black"
          : null
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
 * A reader that looks at every rung of the ladder and keeps the placement the
 * most of them agree on, exactly.
 *
 * Agreement is a different signal from confidence and catches what confidence
 * cannot: a grid found one square off classifies every tile it does find at
 * 0.94 and calls itself reliable, and no other scale agrees with it. Ties go
 * to the higher minimum confidence, which is the only thing left to ask.
 */
function voting(classify: Classify, prepare: (image: GrayImage) => GrayImage) {
  return async (image: GrayImage) => {
    const counts = new Map<string, { agreement: number; read: Read }>()
    for (const size of LADDER) {
      const prepared = prepare(shrink(image, size))
      const read = await recognizeGray(prepared, (corners) =>
        classify(prepared, corners)
      )
      if (!read) continue
      const seen = counts.get(read.placement)
      const agreement = (seen?.agreement ?? 0) + 1
      counts.set(read.placement, {
        agreement,
        read:
          seen && seen.read.minConfidence >= read.minConfidence
            ? { ...seen.read, agreement }
            : { ...read, agreement },
      })
    }
    const ranked = [...counts.values()].sort(
      (a, b) =>
        b.agreement - a.agreement || b.read.minConfidence - a.read.minConfidence
    )
    return ranked.length ? ranked[0].read : null
  }
}

/** Box-filtered down to a long edge of `max`, or the same image where it is already smaller. */
export function shrink(image: GrayImage, max: number): GrayImage {
  const scale = max / Math.max(image.width, image.height)
  if (scale >= 1) return image

  const width = Math.round(image.width * scale)
  const height = Math.round(image.height * scale)
  const data = new Float32Array(width * height)
  const across = image.width / width
  const down = image.height / height

  for (let row = 0; row < height; row++) {
    const top = Math.floor(row * down)
    const bottom = Math.min(image.height, Math.ceil((row + 1) * down))
    for (let column = 0; column < width; column++) {
      const left = Math.floor(column * across)
      const right = Math.min(image.width, Math.ceil((column + 1) * across))
      let sum = 0
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++)
          sum += image.data[y * image.width + x]
      }
      data[row * width + column] = sum / ((bottom - top) * (right - left))
    }
  }
  return { data, width, height }
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
