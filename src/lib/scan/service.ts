import { createRequire } from "node:module"

import {
  CONFIDENCE_FLOOR,
  extractTiles,
  probsToPlacement,
  recognizeGray,
  resolveOrientation,
  rgbaToGray,
} from "@scoriiu/fenshot"
import * as ort from "onnxruntime-node"

import { getCoach } from "@/lib/auth"

import { decode } from "./decode"
import { upright } from "./orientation"
import { WARP_SIZE, warpToSquare } from "./warp"

import type { BoardCorners, GrayImage } from "@scoriiu/fenshot"
import type { Quad, ScanRead, SeenFrom } from "./rules"

/**
 * A Scan: an image of a board in, a draft placement out. Server only — the
 * classifier runs here and never as wasm in a Coach's browser (ADR-0003).
 *
 * We use fenshot's detector and its classifier, and never its
 * `resolveOrientation` as an applied transform (ADR-0002): it reads which side
 * a board was seen from out of pawn advancement, and a composed mate-in-N has
 * its pawns deep in the other side's half by design. What leaves here is what
 * the classifier saw.
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

/** How many pawns a side make pawn advancement worth reading at all. */
const PAWNS_FOR_A_SUGGESTION = 3

/**
 * Which side the board was seen from, or null when nothing may be said.
 *
 * The heuristic compares how far each side's pawns have advanced, so it needs
 * pawns: with fewer than three a side it took an already-perfect mate-in-1
 * read and rotated it 180°, costing ten squares (ADR-0002). It also answers
 * "white" when it means "I cannot tell", which is the other reason the guard
 * is here and not left to the caller.
 */
export function seenFrom(placement: string): SeenFrom | null {
  const pawns = (side: string) =>
    [...placement].filter((piece) => piece === side).length
  if (
    pawns("P") < PAWNS_FOR_A_SUGGESTION ||
    pawns("p") < PAWNS_FOR_A_SUGGESTION
  ) {
    return null
  }
  return resolveOrientation(placement).orientation
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
    : await recognizeGray(gray, (corners) => classify(gray, corners))
  if (read === "bad_corners") return { ok: false, failure: "bad_corners" }
  if (!read) return { ok: false, failure: "no_board" }

  return {
    ok: true,
    scan: {
      placement: read.placement,
      // Ours to say, on fenshot's floor: the corner path has no detector to
      // have worked it out on the way past, so both paths answer it here.
      reliable: read.minConfidence >= CONFIDENCE_FLOOR,
      meanConfidence: read.meanConfidence,
      minConfidence: read.minConfidence,
      seenFrom: seenFrom(read.placement),
    },
  }
}

/** Sixty-four empty squares, which is never the board anybody meant. */
const NO_PIECES = "8/8/8/8/8/8/8/8"

/**
 * The board those four corners bound, read as one square image — `null` where
 * there was no board in them, the same answer the detector gives.
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

  // An empty square classifies at 0.95, so four corners round a patch of
  // tablecloth come back as an empty board the confidence floor is happy
  // with — the one wrong answer it cannot catch. `recognizeGray` refuses an
  // empty read on the other path; this is the same refusal.
  return read.placement === NO_PIECES ? null : read
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
