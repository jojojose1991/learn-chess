/**
 * What both sides of the network need to know about a Scan. New Puzzle
 * imports this and `./service` is what fills it in, so nothing server-side may
 * be named here: the classifier, its model and `onnxruntime-node` are 283 MB
 * that must never be reachable from a client module (ADR-0003, and
 * docs/learnings/testing.md for how it gets there by accident).
 */

/** Which side of the board an image was taken from. */
export type SeenFrom = "white" | "black"

/** What a Scan read, and how much of it a Coach has to check. */
export type ScanRead = {
  /** The FEN placement field, and only that: an image says nothing about the rest. */
  placement: string
  /**
   * The tiles were classified confidently — never that the Position is right.
   * A board read from Black's side is reliable and mirrored, which is why a
   * Scan always produces a draft for a person to check.
   */
  reliable: boolean
  meanConfidence: number
  minConfidence: number
  /** Which side the board was seen from, or null where the pixels cannot say. */
  seenFrom: SeenFrom | null
}

/** One corner of the board, in the image's own pixels. */
export type Corner = { x: number; y: number }

/**
 * The board's four corners as they appear in the image, clockwise from its top
 * left. Clockwise is load-bearing and not a convention: the other winding is a
 * mirror image, which reads as a confident wrong Position no control on the
 * screen can turn back (ADR-0002).
 */
export type Quad = [Corner, Corner, Corner, Corner]
