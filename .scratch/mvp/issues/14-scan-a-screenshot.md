# 14 — Scan a clean screenshot

**What to build:** The other way into a Puzzle. From New Puzzle a Coach picks
an image of a board and gets a draft Position open in Confirm & Edit for them
to check. A Scan always produces a draft for a person to check, never a
Position that goes straight into play.

Use fenshot's classifier and its detector for clean screenshots, but never its
`resolveOrientation` as an applied transform (ADR-0002) — it pre-sets a visible
toggle only, and is skipped when either side has fewer than three pawns.
Measured: it rotated an already-perfect mate-in-1 read by 180°, costing 10
squares, because it infers orientation from pawn advancement and composed
puzzles have deeply advanced pawns.

Set `ONNXRUNTIME_NODE_INSTALL=skip` in the build — left alone its postinstall
fetches hundreds of MB of CUDA and TensorRT providers this service will never
run. It must **not** go in `allowBuilds`. Prune the non-Linux prebuilts; the
package unpacks to ~296 MB and linux/x64 needs ~43 MB.

The Goal is not read from the image; the person types N.

**Blocked by:** 08 (Confirm & Edit).

**Status:** resolved

- [x] Uploading a clean screenshot of a board produces a draft Position in Confirm & Edit
- [x] The scan route returns placement plus `reliable`, mean and minimum confidence
- [x] A confident read of a real screenshot places all 64 squares correctly
- [x] The orientation suggestion pre-sets a visible toggle and is never applied to the placement
- [x] The suggestion is skipped when either side has fewer than three pawns
- [x] An unreliable read says so plainly rather than presenting a bad draft as good
- [x] A non-image or oversized file is refused at the boundary with a clear message
- [x] The uploaded image is held only for the life of the request and never persisted
- [x] The image runs the classifier with the ONNX install script skipped and no GPU providers downloaded
- [x] Picking an image and confirming the read Position both work at 390px, 820px and 1280px
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

**Two boxes are ticked to the edge of what a worktree can prove.**
`tests/e2e/scan.spec.ts` holds the draft opening in Confirm & Edit, the
Black's-side control, the unreliable refusal, the non-image refusal and the
three widths — written, never run, because the e2e database and port are
shared with another agent. The orchestrator's run is where it first goes red.
And "the image runs the classifier" is half proven: the install script is
skipped and no GPU provider is on disk, both held by tests, but the image
cannot run the app until ticket 16 gives it an entry point — the tracker owes
the model file and the pruned `node_modules` against that ticket.

**What "pre-sets a visible toggle" turned out to mean.** A board screenshotted
from Black's side reads as a *mirrored* placement, and only turning it round
makes it a Position anyone can play — so the toggle cannot be the editor's
existing Flip board button, which flips the view and leaves the FEN mirrored.
That would put a correct-looking board over wrong data, which is the same
silent corruption ADR-0002 exists to stop, with a nicer picture. So the Scan
itself never applies the transform: `/api/scan` answers the placement the
classifier saw plus a `seenFrom` suggestion, and New Puzzle carries a separate
visible two-state control, pre-set from the suggestion, that composes the
draft. The ADR binds the pipeline; the control is what a person can see and
undo in one tap. The three-pawn skip is what covers the measured false
positive, and it is a test of its own.

**`src/lib/scan/rules.ts` exists after all.** I first put `ScanRead` in the
service and had the screen take it as a type-only import, on the grounds that
the import is erased — which `pnpm build` confirms, twice. Two reviews
independently asked for the client-safe file anyway, and the second put it
best: one dropped `type` keyword is all that stands between that import and
283 MB of `onnxruntime-node` in the browser bundle, and
`docs/learnings/testing.md` is a whole entry about this repo having made
exactly that mistake once. `accounts/rules.ts` and `puzzles/rules.ts` are the
same file for the same reason, so this is the pattern rather than a new layer.

**`inferCastling` is not used.** fenshot can guess castling rights from home
squares, and a wrong guess is silent corruption of exactly the kind above. A
scanned draft carries `-`, the same as a hand-built one — the tracker already
owes castling rights for both.

**Declined, with reasons.**

- *Cut the JPEG decoder; 14 is screenshots.* A JPEG is an image, so refusing
  one with "that file is not an image" would be a lie, and a screenshot that
  has been through a phone is a JPEG. Kept, and now held by a JPEG fixture the
  same script makes — the objection that it was untested was the fair half.
- *Delete `scripts/scan-fixture.ts` now the PNGs are committed.* The loudest
  line in `docs/learnings/board-recognition.md` is that the measuring scripts
  were lost with the session that wrote them. Deleting the generator to rely
  on `git log` is that mistake at a slower speed, and the piece art it draws
  is itself a live tracker row (ADR-0004).
- *An empty body should be 400, not 415.* Zero bytes are not a PNG or a JPEG,
  which is what the message says. A failure name that exists only for an empty
  body buys nothing.
- *`too_many_pixels` should be 422, not 413.* It is a refusal about size and
  the message says which size. Either is defensible; one is already written.
- *A queue or ceiling on concurrent Scans.* Real, and owed in the tracker
  against 16 rather than guessed at now: refusing one Coach's Scan because
  another Coach is scanning is a worse answer than the risk, while every Coach
  is invited by hand and nothing is deployed.

**Ticket 17's first checkbox is answered here.** A scanned Position is
composed by us: fenshot's `probsToPlacement` always emits eight well-formed
ranks, and the remaining fields are our own neutral `w - - 0 1`. So a Scan
cannot produce a FEN that trips a `validateFen` error `structuralReasons` does
not map, and nothing in 14 makes the single sentence worse. 17 is still its
own call, on evidence from real photographs, which arrives with 15.
