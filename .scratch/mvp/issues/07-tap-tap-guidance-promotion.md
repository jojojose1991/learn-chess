# 07 — Tap-tap moves, Guidance, and the promotion picker

**What to build:** Moving a piece. Tap a piece, tap a square — no dragging
anywhere, including the editor, because a five-year-old on a touchscreen drags
badly.

Guidance is a toggle. On, tapping a piece marks its legal destination squares.
Off, nothing is marked and the Student must find legal moves unaided. Either
way an illegal move is rejected outright and the piece does not move — Guidance
only changes whether the legal squares are shown *before* the attempt.

A pawn reaching the last rank asks which piece, as four large buttons with
Queen first and biggest.

**Blocked by:** 06 — the board renders a Position.

**Status:** resolved

- [x] Tapping a piece selects it visibly; tapping a destination emits that move
- [x] Tapping the selected piece again deselects; tapping another of your pieces moves the selection
- [x] Tapping an empty square or an opponent's piece with nothing selected does nothing
- [x] With Guidance on, selecting a piece marks exactly its legal destinations
- [x] With Guidance off, selecting a piece marks nothing, and an illegal attempt is still refused with the piece unmoved
- [x] The last move is shown, in the same reserved highlight colour as Guidance
- [x] A promoting pawn opens four buttons, Queen first and largest, and the chosen piece appears
- [x] No drag handler exists anywhere in the component
- [x] Every tap target, the promotion buttons included, is at least 44px on a side at 390px wide
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

Built and reviewed 2026-09-03, in one commit. `Board` gained the marks it is
told to draw; `MoveBoard` is new and holds the tap in progress, the Guidance
marks and the promotion picker. `/puzzles/new` hosts it until 08 replaces that
screen.

**Two components, not one.** `Board` still only draws a Position and emits
taps, because on Confirm & Edit two taps are two placements rather than a move.
`MoveBoard` is the one that turns a pair of taps into an attempt. Collapsing
them would need a mode flag to choose between the two meanings.

**The picker is a native `<dialog>` opened with `showModal()`.** That is where
the focus trap, Escape and the focus that returns to the square come from —
all three were review findings against the first version, which was an
absolutely positioned overlay with `inert` on the board. jsdom 28 implements
`<dialog>` but not its modal half, so `tests/setup-dom.ts` shims `showModal`
and `close` for the markup and `tests/e2e/board.spec.ts` holds the behaviour.

**A defect the review caught before it shipped.** `pieceToMove` skips FEN
validation while `legalTargets` and `isPromotion` do not, so on a Position
`chess.js` rejects — two white kings, say — the first tap selected a piece and
the *next render* threw inside `legalTargets`, taking the tree down with no
error boundary. `MoveBoard` now refuses to move on a Position that cannot be
played. Seen red with the guard removed: `Invalid FEN: too many white kings`
thrown from the new test, which passes with it in.

**Boxes with no honest test at the layer they look like they belong to:**

- *44px tap targets, promotion buttons included.* jsdom computes no layout, so
  this is e2e — and it found a real fault: at 390px the screen's `p-6` left
  each square 42.75px. Seen red at 42.75 with `p-4 sm:p-6` reverted.
- *No drag handler exists anywhere.* A dispatched drag event does nothing
  whether a handler exists or not, so the absence is a lint rule
  (`eslint.config.js`), verified red by adding `onDragStart` to `board.tsx`.
  It bans the `onDrag*`/`onDrop*` JSX surface in `src/**/*.tsx` and nothing
  wider: a pointer-composed drag would still pass. The native `<img>` drag is
  a real gesture, so `draggable={false}` is asserted on both the board's
  artwork and the picker's.
- *The same reserved highlight colour as Guidance.* "Same colour" is one
  token, and asserting its hex asserts the stylesheet back. The measurements
  are in ADR-0005 instead; the marked states are asserted through each
  square's accessible name.

**Review findings declined, with reasons:**

- *Derive the promoting side from `fen.split(" ")[1]` instead of keeping the
  pawn's colour in state.* That puts a FEN parse in a component, and the
  `pieceToMove` call it replaces is what makes a stale selection emit an
  attempt rather than open a picker for a piece that has gone.
- *Drop the `onMove` assertion from "does not ask on an ordinary pawn move".*
  Without it, an `isPromotion` that wrongly said yes while opening no picker
  would swallow the move and the test would still pass.
- *Delete the promotion e2e as 18 taps for two `boundingBox` reads.* It is the
  only place two acceptance boxes are honest — "the chosen piece appears" and
  Escape leaving the pawn unmoved — because nothing below a browser composes
  the picker, the reducer-less screen and `applyMove`. Trimmed instead: the
  count, the names and the order it duplicated are back in the dom test only.
- *Share the piece vocabulary between `PIECE_NAME` and `PROMOTIONS`.* The
  board says "white queen" to a screen reader and the picker's button says
  "Queen"; one map with a capitalisation rule costs more than it saves. The
  artwork URL was genuinely duplicated and is now `pieceSrc` in `board.tsx`.
- *Name the picker's buttons "White queen" rather than "Queen".* A Student
  promoting their own pawn is only ever offered their own colour.

**A pre-existing failure this work did not cause.** `/admin` scrolls sideways
by 120px at 390px, so `tests/e2e/responsive.spec.ts` is red — confirmed red on
`main` at 9cbb92c with this branch stashed. It belongs to 18 and is in the
tracker's carried-forward list.
