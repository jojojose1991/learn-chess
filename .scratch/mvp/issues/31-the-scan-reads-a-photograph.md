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

**Status:** resolved

- [x] `pnpm eval` reads at least 3 of the 4 book photographs perfectly, against 1 today, and the run is committed
- [x] The existing fixtures still pass: `board-white`, `board-black` and `board-white.jpg` read exactly and `board-askew` stays unreliable
- [x] An all-empty read is refused on the automatic path, as `fromCorners` already refuses it, with a test that fails without the refusal
- [x] Orientation is suggested from the kings, and declines rather than guesses when either side does not have exactly one
- [x] Side to move is defaulted from the orientation on New Puzzle, and both controls stay a Coach's to change
- [x] The warning a Coach sees on an untrustworthy read is not minimum confidence alone
- [x] `pnpm typecheck`, `pnpm lint` and `pnpm test` pass

## Comments

`pnpm eval`: the vote reads **252/256 squares, 3 of 4 photographs perfectly,
4 of 4 boards found**, against the frame's 224/256 and one. Orientation from
the kings is 4 right, 0 declined, 0 wrong, against pawn advancement's 2 and 2.
Reproduced three times, identical each run.

**The accuracy is the downscaling, not the vote.** One rung at 500 px reads
254/256 with three perfect boards on its own. What the ladder buys is the
agreement count, which no single rung can produce and which is what criterion
6 rests on. It is also the cheaper of the two — nine rungs took 417 ms against
the full frame's 1047 ms, because every rung is smaller than the picture
(`docs/learnings/board-recognition.md`).

Three defects were found by review after the criteria were met, all in the
vote, and each left a test that fails without its fix:

- **Duplicate rungs voted.** `shrink` returns its input untouched for a rung
  larger than the picture, so an 860 px screenshot — every fixture here — read
  the top four rungs as one picture four times. Two alone clear the agreement
  threshold, so a grid one square off in a screenshot could call itself
  reliable on its own repetition. The eval could not see it: the book
  photographs are 3000×4000, where all nine rungs differ. Red as
  `expected 9 to be 6`.
- **The tie-break used the inverted signal.** Equal agreement fell to
  `minConfidence`, and the measured case is the misaligned grid at 0.941
  against the correct read's 0.36. A tie is now `reliable: false` rather than
  resolved. Red as `expected true to be false`.
- **An all-empty read competed and won.** Empty squares classify at ~0.95, so
  five rungs losing the pieces outvoted four that read them and `scan()`
  refused the whole read. Empties are excluded before ranking. Red as
  `expected '8/8/8/8/8/8/8/8' to be '4k3/8/8/8/8/8/8/4K3'`.

`minConfidence` also reported the most flattering agreeing look rather than the
worst square any of them saw, which is the number a Coach reads.

**Criterion 4 is met but narrower than it sounds.** The kings decline when a
side has not exactly one, and when both stand in one half. They do not decline
when the attacking king has crossed the middle: White's king on the 6th with
Black's driven back to the 4th produces the same ranks as a board seen from
Black's side with both kings at home, and kings alone cannot separate those.
That is a confident wrong answer where pawn advancement gave a decline, and New
Puzzle rotates a perfect read 180° on it. Four photographs cannot measure the
band. Carried in `docs/TRACKER.md`; no test, because asserting the wrong answer
would enshrine it.

**Declined:** a shared grid painter across `tests/lib/scan/ladder.test.ts` and
`tests/lib/scan/service.test.ts`. It is a new file for twelve lines and the two
emit different types — RGBA PNG bytes against a `Float32Array`.
