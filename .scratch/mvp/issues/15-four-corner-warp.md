# 15 — The four-corner warp on the unreliable path

**What to build:** The recovery path for a photo. When a Scan reports itself
unreliable, the Coach drags four handles onto the board's corners and our own
perspective warp feeds the same classifier — which was never the part that
failed.

Measured on a phone photo of a laptop screen: the full pipeline got 37/64 with
the detector straddling the browser tab strip; four manual corners plus a warp
got 64/64 at 0.92 minimum confidence, higher than any clean screenshot. The
cheap alternatives were measured and rejected — the quad's bounding box with no
perspective correction gives 49/64, and re-running the detector on a rough crop
gives 56/64 and still reports unreliable. The homography is doing the work, not
the crop.

Corner tolerance is about ±10% of a tile, so the handles need a zoom loupe.
Minimum confidence collapses well before accuracy does, which is what makes a
"your corners are off" warning possible.

**Blocked by:** 14 (Scan a clean screenshot).

**Status:** ready-for-agent

- [ ] An unreliable Scan offers the four-corner path rather than a dead end
- [ ] Four handles can be dragged onto the corners, each with a zoom loupe showing what is under the finger
- [ ] Submitting the corners returns a placement through the same classifier
- [ ] A real photo of a board, corners placed accurately, reads all 64 squares correctly
- [ ] Corners placed badly produce a low minimum confidence and an on-screen warning that they are off
- [ ] The corners can be adjusted and resubmitted without starting the Scan over
- [ ] The resulting draft opens in Confirm & Edit like any other Scan
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
