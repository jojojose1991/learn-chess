import { describe, expect, it } from "vitest"

import { upright } from "@/lib/scan/orientation"

/**
 * A three-by-two picture whose every pixel says where it is, so a rotation can
 * be read straight off the buffer:
 *
 *   1 2 3
 *   4 5 6
 */
const PICTURE = {
  data: Float32Array.from([1, 2, 3, 4, 5, 6]),
  width: 3,
  height: 2,
}

/**
 * The EXIF a camera writes, as `jpeg-js` hands it back: the APP1 payload from
 * its sixth byte, which leaves the second NUL of "Exif\0\0" in front of the
 * TIFF header. One IFD, one entry, one SHORT.
 */
function exif(orientation: number, endian: "little" | "big" = "little") {
  const little = endian === "little"
  const tiff = new DataView(new ArrayBuffer(1 + 22))
  tiff.setUint8(0, 0) // the NUL jpeg-js leaves behind
  const at = 1
  tiff.setUint8(at, little ? 0x49 : 0x4d)
  tiff.setUint8(at + 1, little ? 0x49 : 0x4d)
  tiff.setUint16(at + 2, 42, little)
  tiff.setUint32(at + 4, 8, little) // IFD0 starts here, eight in
  tiff.setUint16(at + 8, 1, little) // one entry
  tiff.setUint16(at + 10, 0x0112, little) // Orientation
  tiff.setUint16(at + 12, 3, little) // SHORT
  tiff.setUint32(at + 14, 1, little) // one of them
  tiff.setUint16(at + 18, orientation, little)
  return new Uint8Array(tiff.buffer)
}

const rows = ({ data, width }: { data: Float32Array; width: number }) =>
  Array.from({ length: data.length / width }, (_, row) =>
    Array.from(data.slice(row * width, row * width + width))
  )

/**
 * A photograph says which way up it is in a tag rather than in its pixels.
 * Every browser has applied that tag since 2020 and `jpeg-js` never has, so
 * without this the picture a Coach puts handles on and the picture the
 * classifier reads are two different pictures.
 */
describe("standing a photograph up the way it was taken", () => {
  it("leaves a picture alone when nothing says to turn it", () => {
    expect(upright(PICTURE)).toBe(PICTURE)
    expect(upright(PICTURE, exif(1))).toBe(PICTURE)
  })

  it("turns a picture a camera held sideways a quarter turn clockwise, swapping its sides with it", () => {
    const turned = upright(PICTURE, exif(6))

    expect({ width: turned.width, height: turned.height }).toEqual({
      width: 2,
      height: 3,
    })
    expect(rows(turned)).toEqual([
      [4, 1],
      [5, 2],
      [6, 3],
    ])
  })

  it("turns one held the other way three quarters round instead", () => {
    expect(rows(upright(PICTURE, exif(8)))).toEqual([
      [3, 6],
      [2, 5],
      [1, 4],
    ])
  })

  it("turns an upside-down picture over without swapping its sides", () => {
    const turned = upright(PICTURE, exif(3))

    expect(turned.width).toBe(3)
    expect(rows(turned)).toEqual([
      [6, 5, 4],
      [3, 2, 1],
    ])
  })

  it("reads the tag out of a big-endian camera too, because half of them are", () => {
    expect(rows(upright(PICTURE, exif(6, "big")))).toEqual([
      [4, 1],
      [5, 2],
      [6, 3],
    ])
  })

  it("flips a mirrored picture, because the browser already has and the two ends have to agree", () => {
    // 2 is a left-right reflection. Skipping it would leave the picture the
    // Coach puts handles on and the picture the classifier reads mirrored
    // apart — the same failure as a quarter turn, from a rarer tag.
    expect(rows(upright(PICTURE, exif(2)))).toEqual([
      [3, 2, 1],
      [6, 5, 4],
    ])
  })

  it("transposes one a camera was held sideways and something then flipped", () => {
    // 5, the reflection of a quarter turn: rows become columns as they stand.
    const turned = upright(PICTURE, exif(5))

    expect({ width: turned.width, height: turned.height }).toEqual({
      width: 2,
      height: 3,
    })
    expect(rows(turned)).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ])
  })

  it("reads a tag that starts at the first byte, for the day jpeg-js stops leaving a NUL in front of it", () => {
    expect(rows(upright(PICTURE, exif(6).subarray(1)))).toEqual([
      [4, 1],
      [5, 2],
      [6, 3],
    ])
  })

  it("leaves a picture alone when the tag is missing, truncated or nonsense, rather than turning it on a guess", () => {
    expect(upright(PICTURE, new Uint8Array([0, 0x49, 0x49]))).toBe(PICTURE)
    expect(upright(PICTURE, new Uint8Array(0))).toBe(PICTURE)
    expect(upright(PICTURE, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBe(
      PICTURE
    )
    expect(upright(PICTURE, exif(99))).toBe(PICTURE)
  })

  /**
   * Bytes a photograph can carry that would read off the end of themselves.
   * `DataView` throws rather than returning nothing, and there is no `try`
   * between here and the route — so an unguarded read is a crafted image
   * turning "no rotation" into a 500.
   */
  it("refuses to follow a tag that points outside the bytes it came in, rather than throwing out of the Scan", () => {
    const beyond = exif(6)
    // The offset of IFD0, four bytes past the byte order mark.
    new DataView(beyond.buffer).setUint32(1 + 4, 0xffffffff, true)
    expect(upright(PICTURE, beyond)).toBe(PICTURE)

    const overrun = exif(6)
    const entries = new DataView(overrun.buffer)
    // Five entries promised, one supplied — and that one some other tag, so
    // the walk has to reach past the end of the block looking for this one.
    entries.setUint16(1 + 8, 5, true)
    entries.setUint16(1 + 10, 0x0100, true)
    expect(upright(PICTURE, overrun)).toBe(PICTURE)
  })
})
