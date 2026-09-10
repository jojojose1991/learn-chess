# 31 — The Scan reads a photograph

**What to build:** The automatic Scan path made to work on a phone photograph
of a printed diagram, which is what a Coach actually uploads. `pnpm eval`
(`eval/README.md`) is the measurement; today it reads **1 of 4 boards
perfectly** and endorses a wrong answer on a second.

The three defects it found, all in `src/lib/scan/`, and all measured in
`docs/learnings/board-recognition.md`:

- **The detector reads the whole frame.** It follows entire rows and columns
  and accepts a grid line within five *pixels*, so a degree of roll smears one
  over `width · sin θ` — 70 px across a 4000 px frame, 9 px across a 500 px
  one. Its rotation tolerance is a property of the image's size, not of the
  photograph, and downscaling is the only deskew knob there is. A modal vote
  over a ladder of downscales reads 3/4 and finds a board in 4/4.
- **An all-empty read is endorsed as reliable.** Photo 2 comes back
  `8/8/8/8/8/8/8/8` at `reliable: true`, min 0.807, from a picture with five
  pieces in it — `recognizeGray`'s mask-and-rescan gives up after
  `MAX_SCAN_PASSES` and returns the last candidate anyway. `fromCorners`
  already refuses exactly this; the automatic path does not.
- **`seenFrom` asks about pawns on Positions that have none.** Pawn
  advancement declines on half the set, which is composed endgames — precisely
  this app's content. Whose king stands in the near half answers 4/4.

And one thing the confidence floor cannot do: photo 3 at 900 px reads a grid
one square off, 55/64, at `reliable: true` and min 0.941, while the *correct*
read at 1200 px is flagged unreliable. Cross-scale agreement separates them;
minimum confidence does not.

Side to move is **not** in the diagram — a book prints it in the caption. The
default follows the orientation, and the Coach's toggle stays.

**Blocked by:** nothing.

**Status:** ready-for-agent

- [ ] `pnpm eval` reads at least 3 of the 4 book photographs perfectly, against 1 today, and the run is committed
- [ ] The existing fixtures still pass: `board-white`, `board-black` and `board-white.jpg` read exactly and `board-askew` stays unreliable
- [ ] An all-empty read is refused on the automatic path, as `fromCorners` already refuses it, with a test that fails without the refusal
- [ ] Orientation is suggested from the kings, and declines rather than guesses when either side does not have exactly one
- [ ] Side to move is defaulted from the orientation on New Puzzle, and both controls stay a Coach's to change
- [ ] The warning a Coach sees on an untrustworthy read is not minimum confidence alone
- [ ] `pnpm typecheck`, `pnpm lint` and `pnpm test` pass

## Comments

Nothing yet.
