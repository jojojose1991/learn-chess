# 17 — Does a rejected Position need to say more than one sentence?

**What to verify:** `validatePosition` maps five of `validateFen`'s errors to
sentences a Coach can act on — the king counts and pawns on the edge rows —
and collapses every other one to a single `"That is not a legal position."`
The detail `chess.js` offered is discarded, so a bad castling field, a
malformed en-passant square, a broken half-move counter and outright gibberish
are indistinguishable to whoever is looking at the screen.

That was a deliberate call in ticket 01, on two grounds: the remaining strings
are jargon (`castling availability is invalid`, `half move counter number must
be a non-negative integer`) that no Student and few Coaches would read as
help, and in the MVP every Position is built by our own board editor, which
cannot produce those shapes.

Scan is what changes the premise. A Position derived from an image is the first
one we did not construct ourselves, and if the classifier can emit a placement
that trips one of the unmapped errors, the person is told only that something
is wrong and not what. Worth an actual look once Scan is running against real
photos: if the unmapped errors never fire, close this and keep the one
sentence. If they do, they need Coach-readable wording, not the library's.

**Blocked by:** 14 — scan a screenshot. Nothing to verify until a Position
arrives from outside our own editor.

**Status:** resolved

- [x] Determine whether Scan can produce a Position that fails `validateFen`
      with any error `structuralReasons` does not map — it cannot
- [x] If it can, give each reachable error a sentence in the register of the
      other five — no notation, no library vocabulary — not reached
- [x] If it cannot, close this and leave the single sentence in place

## Comments

Raised out of ticket 01's code review rather than a report from use — no one
has hit it. See `src/lib/chess/rules.ts` (`structuralReasons`) and
`docs/learnings/chess-libraries.md` for the full list of 1.4.0 error strings.

**Ticket 15 fired the trigger, and did not bring the photograph.** The four-
corner warp shipped, so a Coach can now put a Position in front of the editor
that our own detector never approved — and, for the first time, one the
classifier itself is *not* confident about, because an unreliable corner read
opens as a draft with a warning rather than being refused (measured: minimum
confidence collapses while the read is still perfect, so refusing it would
throw away correct Positions). That is as far outside our own editor as an
MVP Position gets.

It still cannot trip an unmapped error. Both Scan paths end in fenshot's
`probsToPlacement`, which always emits eight well-formed ranks, and the rest
of the FEN is our own constant `w - - 0 1` — so castling, en-passant and both
counters are ours and are always valid. A wrong read is a *wrong* Position,
not a malformed one: too many kings and pawns on the edge rows, which
`structuralReasons` already maps to sentences. Deliberately misplaced corners
were measured reading `8/2p5/8/4n3/2R1B3/5Q2/2PP1PPP/1NN1K1NR` — nonsense, and
nonsense of exactly the mapped kind.

What 15 did **not** produce is a photograph. Its fixture is a browser
rendering of a keystoned board, so glare, paper grain and halftone are still
unmeasured, and the tracker carries that separately. If the decision is
waiting on evidence that the classifier can emit a structurally odd rank
under photographic degradation, it is still waiting; if it is waiting on
whether *our composition* can, that is answered, and the answer is no.

**Answered: no. The one sentence stays, and no code changed.**

15's reasoning is now measured rather than argued. Fuzzing 20,000 trials a
path, against the real `probsToPlacement` and the real editor operations,
produced **no** `validateFen` error that `structuralReasons` does not already
map:

- **The Scan path.** Random 13-class probabilities over 64 tiles through
  `probsToPlacement`, then through both completions the app can apply.
  `probsToPlacement` writes 64 labels from a fixed alphabet, slices them into
  8 ranks of 8, and collapses runs of `1` to a single digit that can never
  exceed 8 — so a well-formed placement is a property of its construction and
  not of the model behaving. No classifier output, degraded or not, can make
  it emit a malformed rank.
- **The suffix is never the classifier's.** `src/lib/scan/service.ts` builds
  no FEN at all; it returns a placement, and
  `src/routes/_coach/puzzles.new.tsx:158` completes it — `completeFen` for a
  board seen from White, `withPlacementRotated` for one seen from Black. Both
  append our own constant, so castling, en-passant and both counters are ours
  in every case. Both were fuzzed.
- **The editor path.** Random walks of `withPiece`, `withSideToMove` and
  `withPlacementRotated` from `EMPTY_POSITION`. Only the mapped king-count and
  edge-row errors ever appear.

The other **eleven** strings — 16 in 1.4.0 once the two `${color}` branches are
counted as the four strings they produce, less our five — stay reachable only
from a FEN we did not build. There are two such routes, not one:

- `POST /api/engine/move`, whose body is a string from anyone. Nobody reads
  its wording: `src/components/play-puzzle.tsx` throws on the *status* and
  never opens the 422's message.
- `savePuzzle`, whose `.validator((data: PuzzleDraft) => data)` is a type
  annotation that strips nothing at runtime, so a signed-in Coach can put any
  string in `fen`. This one **is** shown —
  `src/components/puzzle-editor.tsx:189` renders `validity.reasons`, and the
  same sentence is on screen throughout normal editing.

So the fallback is read by people; what no one can do is *reach an unmapped
one* through a screen, because every FEN the editor and Scan produce is built
by `withPiece`, `withSideToMove`, `withPlacementRotated` and `completeFen`,
and the fuzzing above is over exactly those. Getting an unmapped string onto a
screen takes hand-crafting a malformed FEN into your own save request, which
is not a Coach being failed by our wording.

The trigger, then, is not Scan and never was: it is **a screen given an
arbitrary FEN it did not build, to validate for a person who did not write
it.** Nothing does that today.

**One premise above is wrong, and stays there as the record.** The opening
paragraph says "every Position is built by our own board editor". It is the
only *UI*, but `savePuzzle` has taken an unvalidated FEN off the wire since
ticket 08 — so the sentence was already untrue when written. It did not change
this answer, and correcting the reasoning is worth more than tidying the
sentence.

No test is left behind: nothing shipped wrong, so there is no defect to hold.
A test asserting that a fuzzed classifier read never trips an unmapped error
would be asserting a property of `probsToPlacement`, which is a vendored
library's construction and not our behaviour to pin.
