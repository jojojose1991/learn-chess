# Scan uses fenshot's classifier but not its detector, and never its orientation

`@scoriiu/fenshot` has two halves with opposite value for us. We use its board
detector for clean screenshots — over a ladder of downscales, keeping the
placement the most of them agree on — bypass it entirely for photos by
supplying four hand-dragged corners and our own homography, and do not use its
`resolveOrientation` at all: which side a board was drawn from is suggested
from the kings, and pre-sets a visible toggle rather than being applied.

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
precisely our content type. Guarded to three pawns a side it declined on half
of the first four real photographs; the side whose king stands in the near half
answered all four, and a king is on every board. So the suggestion comes from
the kings, and `resolveOrientation` is not called.

The kings trade a decline for a guess, which is the part to know before
trusting it. Pawn advancement declined on a pawnless board; the kings answer,
and answer wrong when the attacking king has crossed the middle — White's king
on the 6th with Black's driven back to the 4th produces the same ranks as a
board seen from Black's side with both kings at home. Kings alone cannot
separate those, and four photographs cannot measure the band. It won on the
evidence there is (4 right, 0 declined, 0 wrong, against pawns' 2 and 2), and
it is still a suggestion under a control; do not read "declines rather than
guesses" as covering this case.

## Consequences

Corner-drag tolerance is about ±10% of a tile, so the handles need a zoom loupe.
Minimum confidence collapses well before accuracy does, giving a usable
"your corners are off" warning. A future reader tempted to "fix" this by calling
the library's own entry point, or by trusting `resolveOrientation`, should
re-run the measurements first.

## Amended 2026-09-10: the detector reads a ladder, not the frame

Four photographs of a printed book (`eval/`, and
docs/learnings/board-recognition.md) said the automatic path had three defects,
and all three were the same shape — a signal read at one scale, trusted alone.

- **The frame is the wrong scale, and there is no right one.** The detector
  follows whole rows and columns and accepts a grid line within five *pixels*,
  so a degree of roll smears one over `width · sin θ` — 70 px across a 4000 px
  frame. Downscaling is the only deskew knob there is, and which rung suits a
  photograph is not knowable from the photograph. Reading nine and keeping the
  modal placement took the set from 224/256 squares and one perfect board to
  252/256 and three, and found a board in all four.
- **Agreement is a signal the confidence floor does not carry.** A grid found
  one square off is classified at 0.941 and endorses itself, while the scales
  that read the same photograph exactly were at 0.36 and 0.30 and were flagged.
  So an automatic read is `reliable` only if a second scale agrees with it. The
  corner path keeps the floor alone: a Coach placed those corners on one
  picture, there is no second look to have, and the measured collapse from 0.92
  to 0.35 at a tenth of a tile is the warning that path needs.
- **An all-empty read is refused on both paths.** `recognizeGray` masks and
  rescans an empty read, then returns it anyway once `MAX_SCAN_PASSES` is up —
  measured `8/8/8/8/8/8/8/8` at `reliable: true` from a photograph with five
  pieces in it. `fromCorners` already refused this; the refusal now sits above
  both of them.

Side to move is not in a diagram at all — a book prints it in the caption —
so New Puzzle defaults it to the side the board was drawn from. That is a
convention, not a read, and both controls stay a Coach's to change.
