import { readFileSync } from "node:fs"

/** A corner of the board, in the picture's own pixels. */
type Corner = { x: number; y: number }

/**
 * The keystoned fixture's size and where its four corners landed — corners a
 * Coach placed perfectly, in other words. `pnpm tsx scripts/scan-fixture.ts`
 * writes both, the coordinates measured by the browser that drew them.
 *
 * Structurally a `Quad` without naming one: `tests/e2e` reaches this file too
 * and nothing there resolves `@/`.
 */
export const KEYSTONE = JSON.parse(
  readFileSync(new URL("./board-keystone.json", import.meta.url), "utf8")
) as {
  width: number
  height: number
  corners: [Corner, Corner, Corner, Corner]
}

/**
 * The same four, each dragged `pixels` out of place on both axes — so the
 * displacement is √2 of that, and a tile on this fixture is about 77 px.
 */
export const outBy = (pixels: number) =>
  KEYSTONE.corners.map(({ x, y }, at) => ({
    x: x + (at % 2 ? pixels : -pixels),
    y: y + (at < 2 ? pixels : -pixels),
  })) as [Corner, Corner, Corner, Corner]
