import { CONFIDENCE_FLOOR, recognizeGray } from "@scoriiu/fenshot"

import { NO_PIECES } from "./rules"

import type {
  BoardCorners,
  GrayImage,
  RecognitionResult,
} from "@scoriiu/fenshot"

/**
 * The automatic path: the same picture read at several sizes, keeping the
 * placement the most of them agree on.
 *
 * Downscaling is deskewing, and it is the only deskew knob there is. The
 * detector follows whole rows and columns and accepts a grid line within five
 * *pixels*, so a degree of roll smears one over `width · sin θ` — 70 px across
 * a 4000 px frame and 9 px across a 500 px one. Its rotation tolerance is
 * therefore a property of the image's size and not of the photograph, and a
 * phone photograph of a page always has a degree or two of roll in it.
 *
 * Measured over four photographs of a printed book, 64 squares each
 * (docs/learnings/board-recognition.md): the whole frame read 224/256 with one
 * board perfect, and this reads 252/256 with three. The accuracy is the
 * downscaling, not the vote — one rung at 500 px reads 254/256 with three on
 * its own. What the ladder buys is the agreement count, which no single rung
 * can produce and which is what an untrustworthy read is judged on. It is
 * also the cheaper of the two: nine rungs took 417 ms against the full
 * frame's 1047 ms, because every rung is smaller than the picture.
 *
 * Shared with `eval/`, which is what measured it.
 */

/**
 * The long edges a read is taken at. Nine rungs rather than the two that
 * scored best on their own, because which rung suits a photograph is not
 * knowable from the photograph — the ladder is what makes the vote possible,
 * and the vote is what catches a grid found in the wrong place.
 */
export const LADDER = [1600, 1200, 1000, 900, 800, 700, 600, 500, 400]

/**
 * How many rungs have to have read the same thing before it is a read anybody
 * should trust.
 *
 * Two, because two is what separates the measured pair: a photograph read one
 * square off at 900 px was classified at 0.941 and endorsed itself, while the
 * scales that read it exactly were at 0.36 and 0.30 and were flagged. A grid
 * found one square out is classified confidently and no other scale agrees
 * with it, so agreement catches what the confidence floor cannot.
 */
const AGREEING_SCALES = 2

/** What the ladder made of a picture. */
export type Read = {
  /** The FEN placement field as the classifier saw it — never rotated. */
  placement: string
  meanConfidence: number
  minConfidence: number
  /** How many rungs read exactly this. */
  agreement: number
  /** Enough scales agreed, and every square was classified above the floor. */
  reliable: boolean
}

/** The model's own input and output: an image and a box in, a placement out. */
export type Classify = (
  image: GrayImage,
  corners: BoardCorners
) => Promise<RecognitionResult>

/**
 * The placement the most rungs of the ladder agree on, or `null` when none of
 * them found a board at all.
 *
 * Two placements read by as many scales as each other is not a read: the only
 * signal left to separate them is confidence, and confidence is the signal
 * this whole module exists because it is inverted here. A tie is reported
 * rather than resolved — it comes back with `reliable: false`.
 */
export async function readByVote(
  gray: GrayImage,
  classify: Classify
): Promise<Read | null> {
  const reads: Array<RecognitionResult> = []
  for (const size of rungsOf(gray)) {
    const rung = shrink(gray, size)
    const read = await recognizeGray(rung, (corners) => classify(rung, corners))
    // An empty board is not a candidate to be outvoted by. An empty square
    // classifies at about 0.95, so empty reads arrive as the most confident
    // on the ladder, and on a sparse composed endgame — this app's whole
    // content — enough rungs losing the pieces would outvote the rungs that
    // read them. `scan()` refuses an empty read outright; letting one win
    // here would throw away the board two scales agreed on exactly.
    if (read && read.placement !== NO_PIECES) reads.push(read)
  }
  if (!reads.length) return null

  // One group per distinct placement, largest first. Ties fall to the group
  // whose worst square is best, which is only ever a deterministic order:
  // a tied read is untrustworthy below whichever way it is broken.
  const groups = [...new Set(reads.map((read) => read.placement))]
    .map((placement) => reads.filter((read) => read.placement === placement))
    .sort((a, b) => b.length - a.length || worstOf(b) - worstOf(a))
  const best = groups[0]
  // Sorted, so the runner-up can only match or trail: matching is the tie.
  const contested = groups.length > 1 && groups[1].length === best.length

  return {
    placement: best[0].placement,
    meanConfidence:
      best.reduce((total, read) => total + read.meanConfidence, 0) /
      best.length,
    // The worst square any agreeing scale saw, not the worst of the kindest
    // of them: this number reaches a Coach as the warning on their draft.
    minConfidence: worstOf(best),
    agreement: best.length,
    reliable:
      best.length >= AGREEING_SCALES &&
      worstOf(best) >= CONFIDENCE_FLOOR &&
      !contested,
  }
}

/** The worst square any of these agreeing reads saw. */
const worstOf = (group: Array<RecognitionResult>) =>
  Math.min(...group.map((read) => read.minConfidence))

/**
 * The rungs worth reading this picture at: every distinct size, because
 * `shrink` hands back the original untouched for any rung larger than the
 * picture and reading the same pixels twice is not two scales agreeing.
 *
 * A screenshot is the case that matters — 860 px on its long edge makes the
 * top four rungs one picture read four times, and two of those alone clear
 * `AGREEING_SCALES`. A picture at or below the bottom rung gets one look, and
 * one look is honestly reported as no agreement at all.
 */
function rungsOf(image: GrayImage): Array<number> {
  const longEdge = Math.max(image.width, image.height)
  return [...new Set(LADDER.map((size) => Math.min(size, longEdge)))]
}

/**
 * Box-filtered down to a long edge of `max`, or the same image where it is
 * already smaller. Averaged rather than sampled, because a hatched dark square
 * point-sampled at a tenth of its size comes back whatever pixel was landed
 * on — and the hatching is how a book prints a dark square.
 */
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
