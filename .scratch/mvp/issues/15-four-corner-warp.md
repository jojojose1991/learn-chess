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

**Status:** resolved

- [x] An unreliable Scan offers the four-corner path rather than a dead end
- [x] Four handles can be dragged onto the corners, each with a zoom loupe showing what is under the finger
- [x] Submitting the corners returns a placement through the same classifier
- [ ] A real photo of a board, corners placed accurately, reads all 64 squares
      correctly — **no photograph exists to try.** A browser-rendered keystone
      reads 64/64 at 0.915; see the Comments
- [x] Corners placed badly produce a low minimum confidence and an on-screen warning that they are off
- [x] The corners can be adjusted and resubmitted without starting the Scan over
- [x] The resulting draft opens in Confirm & Edit like any other Scan
- [ ] The four handles can be dragged accurately at 390px, and the loupe is
      what makes that true — the plumbing is held at 390px by an **unrun**
      e2e; a finger and the loupe are not measurable here
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

**A photograph never arrived, and that is the one criterion left open.** The
fixture is a browser rendering — `perspective(1000px) rotateY(-17deg)
rotateX(7deg)`, screenshotted as a q80 JPEG — so it carries real projective
distortion and real compression and no glare, paper grain, shadow gradient or
halftone. Against it, exact corners read **64/64 at 0.915 minimum confidence**
while the detector left to itself returns **no board at all**, which is the
ticket's premise reproduced on an image the pipeline had never seen. What that
does not prove is a camera. The tracker owes it against 16, the first
deployment a Coach can point a phone at.

**The warning fires before the read goes wrong, so it cannot be a refusal.**
Measured: corners 8px out on both axes still read 64/64 while `reliable` had
already dropped from 0.915 to 0.375. So an unreliable *corner* read opens as a
draft with "those corners may be off" beside it, while an unreliable
*automatic* read still refuses exactly as 14 decided. The two are not
inconsistent, and the reason is not the number: a detector-unreliable read
means the box was in the wrong place, and a corner-unreliable read means only
slop in a geometry the Coach chose and can nudge. Refusing the second would
throw away correct Positions.

**Clockwise is a rule and not a convention.** The other winding is a mirror
image, which reads as a confident wrong Position that no control on the screen
can turn back — so `warpToSquare` refuses it, and the same check is what keeps
the homography's denominator non-zero. A Coach who crosses two handles gets a
422 saying which way round they go. It also means the four corners correct any
rotation for free: a board photographed sideways comes out upright as long as
the handles go on the *board's* corners rather than the picture's.

**Two defects were found by review and fixed here rather than filed.**

- Four corners round a blank patch warped to one flat colour, which the
  classifier reads as sixty-four empty squares at 0.95 and `reliable: true` —
  the one wrong answer the confidence floor cannot catch, and reachable by a
  client that measured its handles in display pixels. Now `no_board`, which is
  what the detector's own path already answered. Its test was written first
  and failed against the old code.
- A photograph carrying an EXIF orientation tag reached the two ends a quarter
  turn apart: every browser has applied that tag since 2020 and `jpeg-js`
  never has, so on a phone photo every corner a Coach placed landed outside
  the frame the server checked it against — a dead end on the one path this
  ticket exists for. `src/lib/scan/orientation.ts` stands the picture up
  server side, which fixes the automatic path too. Measured in this repo's own
  chromium and written up in `docs/learnings/board-recognition.md`, including
  that `image-orientation: none` is *not* the fix and makes it worse. All
  eight tags are applied, the four mirrored ones included: a review pointed
  out that skipping them reproduces the same disagreement from a rarer tag,
  and that nothing is being mirrored the file did not already say was.
- A third review pass found the two bounds guards in that EXIF walk untested,
  and `DataView` throws rather than returning nothing — so a photograph with
  an IFD offset pointing past its own bytes would have turned "no rotation"
  into a 500. Both guards now have a test that fails without them.

**Two boxes are left unticked rather than ticked with an excuse.** The real
photograph, above; and "the handles can be dragged accurately at 390px, and
the loupe is what makes that true". An **unrun** e2e drives a programmatic
drag at 390px and asserts the board reads, which is the plumbing; a thumb is
not measurable here and the loupe is `aria-hidden`, so no test can name it.
Its arithmetic — where the magnified picture sits so the corner lands under
the crosshair, the only part that can be silently wrong — is held by
`loupeBackground` in the picker's own test. The rest is a circle with a cross
in it, and the tracker owes someone looking at it.

**`tests/e2e/scan.spec.ts` gained three tests and none of them has been run.**
The e2e database and port 3013 are shared with two other agents, and
`pnpm e2e:db` drops the database `WITH (FORCE)` out from under whoever is
mid-run. The orchestrator's is the first run; that is where they go red.

**`pnpm tracker` was not run**, on the orchestrator's instruction — three
agents regenerating the same table would conflict over it for nothing. So
`docs/TRACKER.md`'s generated table still calls 15 ready while this file says
resolved. The hand-written Carried forward rows below it are mine and are
current.

**Declined, with reasons.**

- *Delete `Number.isFinite` from the route's corner parsing; the warp's range
  check refuses NaN anyway.* Kept. It is the controller's job to validate the
  shape of an untrusted parameter, it keeps NaN out of the service entirely
  rather than relying on a downstream comparison, and it is the difference
  between a 400 and a 422 for `?corners=a,b,c,d,e,f,g,h`. It has a test row of
  its own now, which the finding was right that it lacked.
- *Delete the same check from `warpToSquare`.* Taken there — inside the pure
  function it genuinely is dead, because neither NaN nor either infinity
  survives a comparison against both ends of a range. A comment says so, so
  nobody adds it back.
- *`?corners=,,,,,,,` parses as eight zeros and answers 422 rather than 400.*
  Left. It is refused either way, with a message about corners, to a caller
  who sent no corners; a second string check to move one status digit is not
  worth the line.
- *The 400 for malformed corners now precedes the 401 for no session.* Left.
  The parameter is named in the client bundle, so an anonymous caller learns
  nothing from it, and moving the check after the session would put query
  string parsing in the service.
- *`vi.setConfig({ testTimeout: 30_000 })` is unjustified headroom.* Taken in
  part, at 15 s with the measurement in the comment. The suite's slowest scan
  test measured 2.6 s on a quiet machine and over 5 s with three worktrees
  building at once, and every test in these two files re-imports the service
  under `resetModules` and so pays its own `InferenceSession.create`. The
  tracker owes the session-per-test half against 16.
- *`picking` is derivable from `refusal || warning`.* Kept as state. A clean
  corner read has neither, and the handles have to stay on screen for the
  Coach to nudge and read again — which is a criterion.
- *`setShowing(at)` in the keyboard handler duplicates `onFocus`.* Kept. A
  mouse drag ends with the handle still focused and the loupe already put
  away, and the next arrow key wants it back.
- *Fold the 390px e2e into the main journey with a width loop.* Left separate.
  The main journey saves a Puzzle by name, so running it twice would put two
  rows with one name in a shared database and make the link lookup ambiguous —
  and I cannot run the suite to find out.
- *The keyboard nudge now reads the corner the updater has rather than the one
  this render closed over — write the test that would have caught it.* Not
  written, and this is the one place where no test rather than a dishonest
  one applies: React Testing Library wraps each `fireEvent` in its own `act`,
  so two keydowns are two renders and the old value-based version passes
  identically. It would have taken a test that reaches past the library to
  batch them, which is a test of React and not of this component.
- *The e2e should assert the loupe appears.* Not written. It is `aria-hidden`,
  so the only handle on it is a class name, and a test coupled to styling is
  worse than the gap it hides. Tracker row instead.
