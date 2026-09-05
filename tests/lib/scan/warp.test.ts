import { describe, expect, it } from "vitest"

import { WARP_SIZE, warpToSquare } from "@/lib/scan/warp"

import type { Quad } from "@/lib/scan/rules"

/**
 * Measured through a ramp: an image whose grey value *is* one of its own
 * coordinates. Bilinear interpolation along a straight line is exact, so a
 * warped pixel reading 170.6 was sampled at 171.1 in the source — the warp
 * says in its own output where it looked. A pixel's value is its index and its
 * centre is half a pixel further on, which is the 0.5 in every number below.
 */
const ramp = (axis: "x" | "y", size: number) => {
  const data = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) data[y * size + x] = axis === "x" ? x : y
  }
  return { data, width: size, height: size }
}

/** The warp, or the refusal a test that expected a board did not ask for. */
function square(image: ReturnType<typeof ramp>, quad: Quad) {
  const warped = warpToSquare(image, quad)
  if (!warped) throw new Error("those four corners were refused")
  return warped
}

/** The whole of a `size`×`size` image, clockwise from its top left. */
const wholeImage = (size: number): Quad => [
  { x: 0, y: 0 },
  { x: size, y: 0 },
  { x: size, y: size },
  { x: 0, y: size },
]

/**
 * A board seen from off to one side: its far edge a quarter narrower than its
 * near one. Its diagonals cross at (128, 170⅔) — two thirds of the way down,
 * not half.
 */
const KEYSTONE: Quad = [
  { x: 0, y: 0 },
  { x: 256, y: 0 },
  { x: 192, y: 256 },
  { x: 64, y: 256 },
]

/**
 * A board tilted about both axes at once, which every real photograph is. The
 * two halves of the perspective term are separate numbers and this is the quad
 * where both are non-zero — on `KEYSTONE` one of them is exactly zero, so a
 * warp that ignored it would read that board perfectly and this one nowhere
 * near.
 */
const TILTED: Quad = [
  { x: 0, y: 0 },
  { x: 256, y: 32 },
  { x: 224, y: 224 },
  { x: 32, y: 256 },
]

/** The warped pixel nearest the middle of the board. */
const middle = (warped: { data: Float32Array }) =>
  warped.data[(WARP_SIZE / 2) * WARP_SIZE + WARP_SIZE / 2]

describe("warping four corners into a square board", () => {
  it("gives the image back unchanged when the four corners are the image, so a screenshot loses nothing on the way through", () => {
    const source = ramp("x", 256)

    const warped = square(source, wholeImage(256))

    expect({ width: warped.width, height: warped.height }).toEqual({
      width: WARP_SIZE,
      height: WARP_SIZE,
    })
    const changed = source.data.filter(
      (value, index) => value !== warped.data[index]
    )
    expect(changed.length).toBe(0)
  })

  it("samples where the quad's diagonals cross, because a perspective warp is what reads a keystoned board and a crop is not", () => {
    // A quad's own centre is where its diagonals meet, and on this one that is
    // two thirds of the way down. An affine map — or the bounding box, which
    // measured 49/64 against the warp's 64/64 — would sample halfway, at 128.
    expect(middle(square(ramp("y", 256), KEYSTONE))).toBeCloseTo(170.6, 1)
    expect(middle(square(ramp("x", 256), KEYSTONE))).toBeCloseTo(127.8, 1)
  })

  it("corrects a board tilted both ways at once, which is every photograph anybody takes", () => {
    // Both directions of the perspective term matter here and neither does on
    // its own: drop either and this reads 107 or 139 rather than 143.9.
    expect(middle(square(ramp("x", 256), TILTED))).toBeCloseTo(143.9, 1)
    expect(middle(square(ramp("y", 256), TILTED))).toBeCloseTo(143.9, 1)
  })

  it("stretches the narrow end of a keystoned quad back to full width, so the far rank comes out the size of the near one", () => {
    const across = square(ramp("x", 256), KEYSTONE)

    // The last row of the warped board is the quad's short edge — 64 to 192 in
    // the source — filling all 256 pixels of the output.
    const bottom = (x: number) => across.data[(WARP_SIZE - 1) * WARP_SIZE + x]
    expect(bottom(0)).toBeCloseTo(64, 0)
    expect(bottom(WARP_SIZE - 1)).toBeCloseTo(191, 0)
  })

  it("reads a picture that is not already 256 across, which no photograph is", () => {
    // A quarter of the size, so every output pixel is a quarter of a source
    // one: the middle of the board is source pixel 31.6, not 128. The first
    // column lands left of the first pixel's centre and repeats the edge
    // rather than reading off the end of the buffer.
    const small = square(ramp("x", 64), wholeImage(64))

    expect(middle(small)).toBeCloseTo(31.625, 3)
    expect(small.data[0]).toBe(0)
  })
})

describe("four corners that are not a board", () => {
  const refusals: Array<[string, Quad]> = [
    [
      "three of them in a line, or two on the same point",
      [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 200, y: 200 },
        { x: 0, y: 256 },
      ],
    ],
    [
      "crossed over into a bow tie",
      [
        { x: 0, y: 0 },
        { x: 256, y: 0 },
        { x: 0, y: 256 },
        { x: 256, y: 256 },
      ],
    ],
    [
      "given anticlockwise, which would read the whole board mirrored",
      [
        { x: 0, y: 0 },
        { x: 0, y: 256 },
        { x: 256, y: 256 },
        { x: 256, y: 0 },
      ],
    ],
    [
      "off the left edge of the image",
      [
        { x: -1, y: 0 },
        { x: 256, y: 0 },
        { x: 256, y: 256 },
        { x: 0, y: 256 },
      ],
    ],
    [
      "past the bottom of the image",
      [
        { x: 0, y: 0 },
        { x: 256, y: 0 },
        { x: 256, y: 257 },
        { x: 0, y: 256 },
      ],
    ],
    [
      "a coordinate that is not a number",
      [
        { x: 0, y: 0 },
        { x: Number.NaN, y: 0 },
        { x: 256, y: 256 },
        { x: 0, y: 256 },
      ],
    ],
  ]

  it.each(refusals)("refuses four corners with %s", (_, quad) => {
    expect(warpToSquare(ramp("x", 256), quad)).toBeNull()
  })
})
