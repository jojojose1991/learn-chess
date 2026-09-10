import { createRequire } from "node:module"

import {
  CONFIDENCE_FLOOR,
  extractTiles,
  probsToPlacement,
  rgbaToGray,
} from "@scoriiu/fenshot"
import * as ort from "onnxruntime-node"

import { getCoach } from "@/lib/auth"

import { decode } from "./decode"
import { readByVote } from "./ladder"
import { upright } from "./orientation"
import { WARP_SIZE, warpToSquare } from "./warp"

import type { BoardCorners, GrayImage } from "@scoriiu/fenshot"
import { NO_PIECES } from "./rules"

import type { Quad, ScanRead, SeenFrom } from "./rules"

/**
 * A Scan: an image of a board in, a draft placement out. Server only — the
 * classifier runs here and never as wasm in a Coach's browser (ADR-0003).
 *
 * We use fenshot's detector and its classifier, and never its
 * `resolveOrientation` at all (ADR-0002): it reads which side a board was seen
 * from out of pawn advancement, and a composed mate-in-N has its pawns deep in
 * the other side's half by design. What leaves here is what the classifier
 * saw, with which side it was seen from as a suggestion beside it.
 *
 * The image is held for the life of the call and written nowhere.
 */

export type ScanOutcome =
  | { ok: true; scan: ScanRead }
  | {
      ok: false
      failure:
        | "unauthenticated"
        | "too_large"
        | "not_an_image"
        | "too_many_pixels"
        | "unreadable"
        | "no_board"
        | "bad_corners"
    }

/** The first rank of the near half, counting from the top of the picture. */
const NEAR_HALF = 4

/**
 * Which side the board was seen from, or null when nothing may be said: the
 * side whose king stands in the near half is the side it was drawn from.
 *
 * A king is on every board and pawns are not, which is the whole argument.
 * fenshot's own `resolveOrientation` compares how far each side's pawns have
 * advanced, and that declines on exactly the composed endgames this app is
 * for — it read 2 of 4 photographs of a book and this read 4 (ADR-0002,
 * docs/learnings/board-recognition.md). A suggestion either way: it pre-sets
 * a control a Coach can change and is never applied here.
 *
 * It guesses, and it can guess wrong. The kings say nothing when the attacking
 * king has crossed the middle: White's king on the 6th with Black's driven
 * back to the 4th is read from White's side and the same ranks are what a
 * board seen from Black's side with both kings at home produces. That is
 * ordinary mate-in-N geometry, and it is a confident wrong answer rather than
 * a decline — where the retired pawn heuristic declined on a pawnless board,
 * this one answers. Four photographs cannot see that band; New Puzzle rotates
 * on it, so one tap on the orientation control is the whole cost, and
 * `docs/TRACKER.md` carries it.
 */
export function seenFrom(placement: string): SeenFrom | null {
  const ranks = placement.split("/")
  // Exactly one of each, because a misread board can carry two of a colour
  // and the first one found would answer confidently for both. Declining is
  // the whole contract of being able to return null.
  const rankOf = (king: string) => {
    const on = ranks.flatMap((rank, index) =>
      [...rank].filter((piece) => piece === king).map(() => index)
    )
    return on.length === 1 ? on[0] : -1
  }

  const white = rankOf("K")
  const black = rankOf("k")
  if (white < 0 || black < 0) return null
  if (white >= NEAR_HALF && black < NEAR_HALF) return "white"
  if (black >= NEAR_HALF && white < NEAR_HALF) return "black"
  // Both kings in one half, which says nothing at all.
  return null
}

/**
 * The draft a Coach gets to check, or why there is not one.
 *
 * The image arrives as a thunk rather than as bytes so that the session is
 * read before a body is: an upload is megabytes of a shared container's
 * memory, and who is asking is the cheapest refusal there is. Everything after
 * it is arithmetic on a header, and only then an allocation.
 *
 * `quad` is the recovery path: four corners a Coach placed, warped square
 * here, and the detector — the half that failed — left out (ADR-0002).
 */
export async function scan(
  readImage: () => Promise<Uint8Array | "too_large">,
  headers: Headers,
  quad?: Quad
): Promise<ScanOutcome> {
  if (!(await getCoach(headers))) {
    return { ok: false, failure: "unauthenticated" }
  }

  const image = await readImage()
  if (image === "too_large") return { ok: false, failure: "too_large" }

  const decoded = decode(image)
  if (typeof decoded === "string") return { ok: false, failure: decoded }

  // Stood up before anything measures it: a phone photograph is landscape
  // pixels plus a tag saying which way round, the browser has already applied
  // that tag to the picture the Coach placed handles on, and `jpeg-js` has
  // not (docs/learnings/board-recognition.md).
  const gray = upright(
    rgbaToGray(decoded.data, decoded.width, decoded.height),
    decoded.exif
  )
  const read = quad
    ? await fromCorners(gray, quad)
    : await readByVote(gray, classify)
  if (read === "bad_corners") return { ok: false, failure: "bad_corners" }

  // One refusal for both paths. An empty square classifies at about 0.95, so
  // sixty-four of them are a confident read of a board nobody meant: four
  // corners round a patch of tablecloth on one path, and a photograph of five
  // pieces that came back `8/8/8/8/8/8/8/8` at 0.807 on the other, because
  // `recognizeGray`'s own mask-and-rescan gives up after `MAX_SCAN_PASSES` and
  // returns the last candidate anyway (docs/learnings/board-recognition.md).
  // It is the one wrong answer no confidence measure can catch.
  if (!read || read.placement === NO_PIECES) {
    return { ok: false, failure: "no_board" }
  }

  return {
    ok: true,
    scan: {
      placement: read.placement,
      reliable: read.reliable,
      meanConfidence: read.meanConfidence,
      minConfidence: read.minConfidence,
      seenFrom: seenFrom(read.placement),
    },
  }
}

/** Sixty-four empty squares, which is never the board anybody meant. */
/**
 * The board those four corners bound, read as one square image.
 *
 * Reliability here is the confidence floor and nothing else: there is no
 * second scale to agree with, because a Coach put these corners on one
 * picture. Minimum confidence collapses from 0.92 to 0.35 at a tenth of a
 * tile of slop, well before accuracy does, which is what makes it a warning
 * about the handles (docs/learnings/board-recognition.md).
 *
 * ponytail: no `snapCorners` arbitration. It corrects a quarter-tile detector
 * error and there is no detector here; add it if a real photograph ever comes
 * back a quarter tile off.
 */
async function fromCorners(gray: GrayImage, quad: Quad) {
  const board = warpToSquare(gray, quad)
  if (!board) return "bad_corners" as const

  // Already square and already the size `extractTiles` resizes to, so its own
  // resample is the identity and there is nothing left to crop.
  const read = await classify(board, {
    x0: 0,
    y0: 0,
    x1: WARP_SIZE,
    y1: WARP_SIZE,
  })

  return { ...read, reliable: read.minConfidence >= CONFIDENCE_FLOOR }
}

/**
 * The model's own input and output, one name each: 64 tiles of 32×32
 * grayscale in, 13 class probabilities a tile out.
 */
async function classify(gray: GrayImage, corners: BoardCorners) {
  const answer = await (
    await classifier()
  ).run({
    tiles: new ort.Tensor("float32", extractTiles(gray, corners), [64, 1024]),
  })
  return probsToPlacement(answer.probs.data as Float32Array)
}

let session: Promise<ort.InferenceSession> | null = null

/**
 * The tile classifier, loaded once: a cold `InferenceSession.create` measured
 * 65–83 ms and a warm read 20–30 ms, so the first Scan of a container's life
 * pays for the rest.
 *
 * A failure is not cached. The model is a file in a package rather than
 * anything a bundler carries, so "it is not on disk" is a real first failure —
 * and a rejected promise left here would answer every later Scan with it.
 */
function classifier(): Promise<ort.InferenceSession> {
  session ??= ort.InferenceSession.create(
    createRequire(import.meta.url).resolve(
      "@scoriiu/fenshot/model/chess-tiles-v2.onnx"
    )
  ).catch((failure: unknown) => {
    session = null
    throw failure
  })
  return session
}
