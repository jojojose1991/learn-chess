import type { GrayImage } from "@scoriiu/fenshot"
import type { Corner, Quad } from "./rules"

/**
 * The recovery path's arithmetic: four corners a Coach put on a photographed
 * board, and the square grayscale image the classifier can read. Pure — no
 * I/O, no fenshot at runtime, nothing that knows what a chess piece is.
 *
 * It is the warp doing the work here and not the crop, which is measured and
 * argued in ADR-0002.
 */

/**
 * The side of the board we warp to. Measured: 256, 512 and 1024 all read
 * 64/64 and only 128 fell below it, so a caller's choice buys nothing — and
 * these numbers arrive over HTTP, where a size argument is an arbitrary
 * allocation with a stranger's hand on it. At 256 `extractTiles`' own resize
 * is the identity.
 */
export const WARP_SIZE = 256

/**
 * The board, square and full-frame, or `null` when those four points are not
 * four corners of anything — off the image, in a line, doubled up, crossed
 * over, or wound anticlockwise.
 *
 * The refusal and the arithmetic are one check: the homography's denominator
 * is twice the area of a triangle of three corners, so a quad that would
 * divide by zero is exactly a quad that is not convex. What is checked here
 * is those four values; that there are four of them at all is the
 * controller's, where the query string is parsed.
 */
export function warpToSquare(image: GrayImage, quad: Quad): GrayImage | null {
  const map = projection(quad, image.width, image.height)
  if (!map) return null

  const data = new Float32Array(WARP_SIZE * WARP_SIZE)
  for (let row = 0; row < WARP_SIZE; row++) {
    const v = (row + 0.5) / WARP_SIZE
    for (let column = 0; column < WARP_SIZE; column++) {
      const u = (column + 0.5) / WARP_SIZE
      const w = map.g * u + map.h * v + 1
      // Less a half, because a pixel's value sits at its centre and these are
      // the continuous coordinates the corners were given in.
      data[row * WARP_SIZE + column] = sample(
        image,
        (map.a * u + map.b * v + map.c) / w - 0.5,
        (map.d * u + map.e * v + map.f) / w - 0.5
      )
    }
  }
  return { data, width: WARP_SIZE, height: WARP_SIZE }
}

/**
 * The homography taking the unit square to the quad, so that the loop above
 * walks the output and reads the input — the only direction that leaves no
 * holes in the result.
 *
 * The general form of this is eight equations in eight unknowns. They are
 * solved here in closed form rather than by elimination because one side of
 * the correspondence is a constant: the unit square never changes, so the
 * solve was done once, on paper (Heckbert, *Fundamentals of Texture Mapping
 * and Image Warping*, 1989, §2.2). Same arithmetic, no pivoting, no matrix.
 */
function projection(quad: Quad, width: number, height: number) {
  if (!isBoardShaped(quad, width, height)) return null

  const [topLeft, topRight, bottomRight, bottomLeft] = quad
  const dx1 = topRight.x - bottomRight.x
  const dx2 = bottomLeft.x - bottomRight.x
  const dx3 = topLeft.x - topRight.x + bottomRight.x - bottomLeft.x
  const dy1 = topRight.y - bottomRight.y
  const dy2 = bottomLeft.y - bottomRight.y
  const dy3 = topLeft.y - topRight.y + bottomRight.y - bottomLeft.y

  const area = dx1 * dy2 - dy1 * dx2
  const g = (dx3 * dy2 - dy3 * dx2) / area
  const h = (dx1 * dy3 - dy1 * dx3) / area

  return {
    a: topRight.x - topLeft.x + g * topRight.x,
    b: bottomLeft.x - topLeft.x + h * bottomLeft.x,
    c: topLeft.x,
    d: topRight.y - topLeft.y + g * topRight.y,
    e: bottomLeft.y - topLeft.y + h * bottomLeft.y,
    f: topLeft.y,
    g,
    h,
  }
}

/**
 * Four points on the picture that turn the same way at every corner. One sign
 * for all four turns is convex and not self-crossing; a turn of exactly zero
 * is three points in a line or two points in one place; and that sign being
 * *positive* is the clockwise winding `Quad` is declared in, without which the
 * board comes back mirrored.
 *
 * A corner off the frame is refused rather than sampled off the edge, which is
 * a product call and not an arithmetic one: handles are dragged on the
 * picture, so a corner outside it did not come from a Coach's finger.
 *
 * Nothing here names NaN or infinity, because neither survives a comparison
 * against both ends of a range.
 */
function isBoardShaped(quad: Quad, width: number, height: number) {
  const onThePicture = ({ x, y }: Corner) =>
    x >= 0 && x <= width && y >= 0 && y <= height

  return quad.every((corner, at) => {
    const next = quad[(at + 1) % 4]
    const after = quad[(at + 2) % 4]
    const along = { x: next.x - corner.x, y: next.y - corner.y }
    const onwards = { x: after.x - next.x, y: after.y - next.y }
    return onThePicture(corner) && along.x * onwards.y - along.y * onwards.x > 0
  })
}

/** The pixel at a fractional position, blended from its four, edges repeated. */
function sample(image: GrayImage, x: number, y: number) {
  const left = Math.floor(x)
  const top = Math.floor(y)
  const acrossBy = x - left
  const downBy = y - top

  return (
    at(image, left, top) * (1 - acrossBy) * (1 - downBy) +
    at(image, left + 1, top) * acrossBy * (1 - downBy) +
    at(image, left, top + 1) * (1 - acrossBy) * downBy +
    at(image, left + 1, top + 1) * acrossBy * downBy
  )
}

const at = (image: GrayImage, x: number, y: number) =>
  image.data[
    Math.min(image.height - 1, Math.max(0, y)) * image.width +
      Math.min(image.width - 1, Math.max(0, x))
  ]
