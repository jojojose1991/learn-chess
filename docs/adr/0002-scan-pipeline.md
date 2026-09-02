# Scan uses fenshot's classifier but not its detector, and never its orientation

`@scoriiu/fenshot` has two halves with opposite value for us. We use its board
detector for clean screenshots, bypass it entirely for photos by supplying four
hand-dragged corners and our own homography, and treat its `resolveOrientation`
as a suggestion that pre-sets a visible toggle — never as an applied transform.

## Why

Measured against four real user images (scripts and full numbers in the design
session; summary here):

- Clean screenshots, full pipeline: **192/192 squares correct** across three
  unrelated board themes, minimum per-tile confidence never below 0.90.
- Phone photo of a laptop screen, full pipeline: **37/64**, with the detector
  returning a box straddling the browser tab strip. It fails loudly —
  `reliable: false`, minimum confidence 0.375 — which is our automatic trigger.
- Same photo, four manual corners plus a perspective warp into the same CNN:
  **64/64 at 0.92 minimum confidence**, higher than any clean screenshot.

The classifier was never the problem; only the detector was. Its training corpus
deliberately includes print and book diagram styles, which is why it survives
glare, moire and keystone once the grid is square.

The cheap alternatives were measured and rejected: the quad's bounding box with
no perspective correction gives **49/64**, and letting the user crop roughly and
re-running the detector gives **56/64** and still reports unreliable. The
four-point homography is doing the work, not the crop.

`resolveOrientation` correctly flips a Black-perspective board, but on a
mate-in-1 image it rotated an already-perfect read 180°, costing 10 squares. Its
heuristic infers orientation from which side's pawns are further advanced, and
composed mate-in-N puzzles routinely have deeply advanced white pawns — which is
precisely our content type. It is a suggestion only, and is skipped when either
side has fewer than three pawns.

## Consequences

Corner-drag tolerance is about ±10% of a tile, so the handles need a zoom loupe.
Minimum confidence collapses well before accuracy does, giving a usable
"your corners are off" warning. A future reader tempted to "fix" this by calling
the library's own entry point, or by trusting `resolveOrientation`, should
re-run the measurements first.
