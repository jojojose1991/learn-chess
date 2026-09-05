import type { GrayImage } from "@scoriiu/fenshot"

/**
 * A photograph knows which way up it was taken and says so in a tag rather
 * than in its pixels. Every browser has applied that tag since 2020 — the
 * `<img>` a Coach sees and the `naturalWidth` the corners are measured in are
 * both already turned — and `jpeg-js` never has.
 *
 * Without this the picture the handles sit on and the picture the classifier
 * reads are two different pictures, a quarter turn apart, and every corner a
 * Coach places on a phone photograph lands outside the frame the server
 * checks it against. Pure, and the only thing here that knows about EXIF.
 */

/**
 * Where a source pixel goes, for each of the eight ways a photograph can be
 * tagged. Seven of them move something: three are turns, and 2, 4, 5 and 7 are
 * reflections, which editing software writes and cameras do not.
 *
 * The reflections are applied rather than skipped, for exactly the reason the
 * turns are: the browser has already applied them to the picture a Coach is
 * putting handles on, so leaving them out here is what makes the two ends
 * disagree. Nothing is mirrored that the file did not already say was.
 */
const PLACINGS: Record<
  number,
  ((x: number, y: number, width: number, height: number) => Placed) | undefined
> = {
  2: (x, y, width) => [width - 1 - x, y],
  3: (x, y, width, height) => [width - 1 - x, height - 1 - y],
  4: (x, y, _width, height) => [x, height - 1 - y],
  5: (x, y) => [y, x],
  6: (x, y, _width, height) => [height - 1 - y, x],
  7: (x, y, width, height) => [height - 1 - y, width - 1 - x],
  8: (x, y, width) => [y, width - 1 - x],
}

/** Across, then down. */
type Placed = [number, number]

/** The four tags that stand the picture on its side, swapping its dimensions. */
const SIDEWAYS = new Set([5, 6, 7, 8])

/** Where the Orientation tag lives, and what a TIFF header looks like. */
const ORIENTATION = 0x0112
const LITTLE_ENDIAN = 0x49
const BIG_ENDIAN = 0x4d

/**
 * The picture the way it was taken, and the same object when it was already
 * that way — turning it costs a second buffer the size of the first, so that
 * is paid for only when there is a turn to make.
 */
export function upright(gray: GrayImage, exif?: Uint8Array): GrayImage {
  const orientation = orientationIn(exif)
  const place = PLACINGS[orientation]
  if (!place) return gray

  const { data, width, height } = gray
  const sideways = SIDEWAYS.has(orientation)
  const across = sideways ? height : width
  const turned = new Float32Array(data.length)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [to, down] = place(x, y, width, height)
      turned[down * across + to] = data[y * width + x]
    }
  }

  return { data: turned, width: across, height: sideways ? width : height }
}

/**
 * The Orientation tag, or 1 for "as it stands" — which is also the answer to
 * every malformed tag, because a photograph that will not say which way up it
 * is has said nothing, and a guess here turns the whole board.
 *
 * `jpeg-js` hands back the APP1 payload from its sixth byte, which leaves the
 * second NUL of `Exif\0\0` in front of the TIFF header, so the byte order mark
 * is looked for rather than assumed.
 */
function orientationIn(exif?: Uint8Array) {
  if (!exif) return 1

  const start = [0, 1].find(
    (at) =>
      (exif[at] === LITTLE_ENDIAN || exif[at] === BIG_ENDIAN) &&
      exif[at] === exif[at + 1]
  )
  if (start === undefined) return 1

  const view = new DataView(
    exif.buffer,
    exif.byteOffset + start,
    exif.byteLength - start
  )
  if (view.byteLength < 8) return 1

  const little = view.getUint8(0) === LITTLE_ENDIAN
  const directory = view.getUint32(4, little)
  if (directory + 2 > view.byteLength) return 1

  const entries = view.getUint16(directory, little)
  for (let entry = 0; entry < entries; entry++) {
    // Twelve bytes each: the tag, its type, how many, and the value itself
    // where it fits in four bytes — which a single SHORT always does.
    const at = directory + 2 + entry * 12
    if (at + 12 > view.byteLength) break
    if (view.getUint16(at, little) === ORIENTATION) {
      return view.getUint16(at + 8, little)
    }
  }
  return 1
}
