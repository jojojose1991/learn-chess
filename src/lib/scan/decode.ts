/**
 * An untrusted image file as pixels, and the ceilings that stop one being a
 * denial of service. Nothing here knows what a chess board is.
 *
 * Shared with `eval/`, which is the reason it is its own file: an eval that
 * decodes an upload differently from the server is measuring a pipeline
 * nobody runs.
 */

import jpeg from "jpeg-js"
import { PNG } from "pngjs"

/**
 * The most pixels a Scan will decode, and the reason it is not larger: a
 * 12 MP PNG passes through pngjs's inflate buffers, its concatenation, its
 * filter output and then a Float32 grayscale — measured nearer 25 bytes a
 * pixel at peak than the 8 the two surviving buffers suggest, so about 300 MB
 * of a container that shares 1 GiB with Stockfish's 377 MiB
 * (docs/learnings/deployment.md). Every screenshot is far under it, and
 * 11 MP measured 221 ms.
 *
 * ponytail: nothing bounds two of these at once — see docs/TRACKER.md.
 */
export const MAX_PIXELS = 12_000_000

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]

export type Decoded = {
  data: Uint8ClampedArray
  width: number
  height: number
  /** The APP1 payload, where the file carried one. PNGs never do. */
  exif?: Uint8Array
}

/**
 * The image as pixels, or which way it was not one. The format comes from the
 * bytes rather than from a `content-type` the caller wrote, because a claim is
 * not a fact and this is where an untrusted file is opened.
 */
export function decode(
  image: Uint8Array
): Decoded | "not_an_image" | "too_many_pixels" | "unreadable" {
  if (startsWith(image, PNG_SIGNATURE)) return decodePng(image)
  if (startsWith(image, JPEG_SIGNATURE)) return decodeJpeg(image)
  return "not_an_image"
}

const startsWith = (image: Uint8Array, signature: Array<number>) =>
  signature.every((byte, index) => image[index] === byte)

/** Where the IHDR's width, height and interlace method sit, from byte zero. */
const IHDR_WIDTH = 16
const IHDR_INTERLACE = 28

/**
 * `pngjs` has no ceiling of its own, so the header is read before it is: width
 * and height are the two big-endian words after the signature and the chunk
 * header, at a fixed offset.
 *
 * An interlaced PNG is refused rather than measured, because for those pngjs
 * takes an *unbounded* `inflateSync` — its length guard is the declared image
 * size, which Adam7 does not go through. Measured: a 306 kB file that declares
 * itself 1×1 allocated 321 MB before it threw, which in the container is an
 * OOM kill and not a `catch`. Screenshots are never interlaced.
 */
function decodePng(image: Uint8Array) {
  if (image.byteLength <= IHDR_INTERLACE) return "unreadable"
  const header = new DataView(image.buffer, image.byteOffset, image.byteLength)
  if (header.getUint8(IHDR_INTERLACE) !== 0) return "unreadable"
  if (
    header.getUint32(IHDR_WIDTH) * header.getUint32(IHDR_WIDTH + 4) >
    MAX_PIXELS
  ) {
    return "too_many_pixels"
  }
  try {
    const png = PNG.sync.read(Buffer.from(image))
    return { data: view(png.data), width: png.width, height: png.height }
  } catch {
    return "unreadable"
  }
}

/**
 * `jpeg-js` does have a ceiling and throws below its own allocation — but it
 * throws the way it does at a corrupt file, so a JPEG too big to decode is
 * answered as one that could not be read. Its defaults are 100 MP and 512 MB,
 * both far past this container's share, so both are passed.
 */
function decodeJpeg(image: Uint8Array) {
  try {
    const decoded = jpeg.decode(image, {
      useTArray: true,
      maxResolutionInMP: MAX_PIXELS / 1_000_000,
      maxMemoryUsageInMB: 256,
    })
    return {
      data: view(decoded.data),
      width: decoded.width,
      height: decoded.height,
      // Handed back but not declared: `jpeg-js`'s own types stop at the
      // pixels, and it reads APP1 as an opaque block it never acts on.
      exif: (decoded as { exifBuffer?: Uint8Array }).exifBuffer,
    }
  } catch {
    return "unreadable"
  }
}

/**
 * The same bytes under the type `rgbaToGray` asks for. A view rather than
 * `new Uint8ClampedArray(bytes)`, which copies element by element — 48 MB of
 * copy for a 12 MP image, to satisfy an annotation the function only indexes
 * through.
 */
const view = (bytes: Uint8Array) =>
  new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength)
