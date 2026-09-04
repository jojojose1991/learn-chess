# 08 — Confirm & Edit, saving a Puzzle to the Library

**What to build:** The by-hand setup tool, which is the same screen that will
later confirm a Scan. From New Puzzle a Coach starts with an empty board,
places pieces, says whose turn it is, sets the Goal to mate in N, and saves it
under a name. It appears in their Library.

The validity check is visible and blocking: while the Position is illegal, play
and save are refused and the reasons are on screen. Authoring a Puzzle is
picking a Goal type and a number — a Coach never enters moves.

**Blocked by:** 07 (tap-tap moves), 05 (Library) and 02 (Goal evaluation).

**Status:** resolved

- [x] New Puzzle offers starting from an empty board and reaches this screen
- [x] Pieces can be placed and removed by tapping, with no dragging
- [x] A flip button changes perspective; a White/Black toggle sets the side to move
- [x] The Goal is mate in N, with N entered by the person
- [x] An illegal Position shows its reasons and blocks both play and save
- [x] A legal Position saves with a name and appears in the Library
- [x] Reopening a saved Puzzle shows the same Position, side to move and Goal
- [x] The screen is usable at 390px, 820px and 1280px with no sideways scrolling, board squares included
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

Built and reviewed 2026-09-04. `src/lib/chess/rules.ts` gained the three pure
things a Position editor needs (`EMPTY_POSITION`, `withPiece`,
`withSideToMove`); `PuzzleEditor` is the screen; `savePuzzle` and `readPuzzle`
write and read one Coach's own Puzzles.

**New Puzzle is Confirm & Edit, not a screen that offers it.** `docs/PLAN.md`
lists them as screens 3 and 4, and today screen 3 would be one button that
navigates. `/puzzles/new` is therefore the editor on an empty board, and 14
adds "Scan an image" beside it — as a second control, or as the choice screen
then, when there is a choice to make. Keeping the route and its heading is also
what keeps the responsive check and the sidebar link unchanged.

**Every tap on the board means what the tray says.** The first cut had a tap on
an occupied square erase it and a tap on an empty one place, which makes one
gesture mean two things depending on state a Coach cannot see. The tray's
thirteenth entry is "empty" instead: replace costs one tap, erase costs two,
and neither depends on what is already there. The tray says the same words the
board's squares do — `pieceName` in `board.tsx` is the one vocabulary.

**A misplaced king moves rather than refusing.** `chess.js`'s `put` returns
false for a second king of a colour, so the naive `withPiece` left the Coach
with a tap that silently did nothing and no way to correct a king but to erase
it first. `withPiece` removes that colour's king before placing.

**`withSideToMove` rewrites FEN fields rather than calling `setTurn`**, which
advances the halfmove clock on every flip — so a Coach toggling White, Black,
White would not land back on the FEN they started with. It also clears the
en-passant square, which belonged to the side that is no longer to move.

**The screen refuses three things at three different controls**, rather than
pooling them into one list: the Position's reasons are the blocking list under
the board and Save is disabled while any stands; the name and N are `required`
and `min`/`max` on their own inputs, so the browser says it at the field. The
server re-checks all three in `draftRefusal`, because `createServerFn`'s
`validator` is a type annotation and strips nothing at runtime.

**Three defects the review caught before they shipped**, each with the test
that would have caught it:

- *A king put back on its own square silently lost that side's castling
  rights.* `chess.js` clears them on the `remove`, and `put` does not give
  them back, so `withPiece(CASTLING, "e1", whiteKing)` returned a placement
  byte for byte the same with `KQ` gone. Latent while nothing carries rights,
  live the moment 14 feeds a scanned Position in. The remove is now skipped
  when the king is already on that square. Seen red: `expected … KQkq` against
  `received … kq`.
- *`save` never cleared `busy` when `onSave` rejected.* A dropped connection —
  what a Coach on a phone actually meets — left Save disabled for good, with
  the Position only they had and no way but a reload that throws it away. It
  is a `try`/`catch`/`finally` now and the failure leaves a log line. Seen
  red on a Save that stayed disabled, with vitest reporting the unhandled
  rejection beside it.
- *`draftRefusal` read the payload before checking its shape.* `{}`,
  `{ name: 12 }` or `{ goal: null }` threw a TypeError, so a body that never
  met the form got a 500 instead of a refusal. The shape is checked first now.
  Seen red: `Cannot read properties of undefined (reading 'trim')`.

**The Coach scoping had no test until the review said so.** The only
not-found test used an id nobody owned, which passes with `coach_id` deleted
from the `where`. `puzzles.spec.ts` now writes another Coach's Puzzle straight
into the database and asks for it by its real id. Seen red with the predicate
removed: the 404 heading never appeared and the editor opened someone else's
Puzzle.

**Boxes with no honest test at the layer they look like they belong to:**

- *Blocks play.* There is no Play control on this screen and no Play screen to
  reach — 09 builds it. What is true and tested: `MoveBoard` already refuses to
  pick up a piece on an invalid Position (07), and this screen blocks Save. The
  box is ticked for Save alone and the rest is in the tracker, triggered by 09.
- *No dragging.* Still the lint rule from 07 (`eslint.config.js`), which covers
  `src/**/*.tsx` and so covers the editor without a new test.
- *390px, 820px, 1280px.* `tests/e2e/responsive.spec.ts`, which already visits
  `/puzzles/new` and passed at all three widths. `/puzzles/$puzzleId` is not in
  that list because it needs a saved row to visit; it renders the same
  component in the same `<main>`.

**The e2e was run, not merely written.** `docker compose`'s 5433 was taken by
another worktree, so the run used a container of its own on 55432 with its own
database. 23 passed; the one failure is `/admin` scrolling sideways at 390px,
which is ticket 22 and was already red on `main`.

**`board.spec.ts`'s promotion journey is gone, and that is a real loss.** It
played nine moves from `/puzzles/new` to reach a promotion, and this ticket
takes that Position away — `MoveBoard` is now mounted on no screen at all until
09. The picker's browser half (Escape leaving the pawn, focus returning, the
44px buttons) has nowhere honest to run, so the test is deleted rather than
pointed at a fixture screen invented to host it. It is in the tracker,
triggered by 09. What survives is `move-board.test.tsx`, which still holds
which pieces are offered and in what order.

**Review findings declined, with reasons:**

- *Fold `savePuzzle`'s insert and update branches into one ternary.* They fail
  differently: nothing written on an update means the Puzzle is not this
  Coach's or has gone, and "That puzzle no longer exists." is the honest
  sentence — on an insert that same branch would be a lie about a driver fault.
- *Delete the DOM test for the tray's "empty" entry as a duplicate of
  `withPiece`.* `withPiece(fen, square, null)` is tested at the rules layer,
  but that the thirteenth tray entry reaches it is the wiring the whole
  no-hidden-gesture decision rests on, and nothing else holds it. The sibling
  finding — that "replaces what stood there" *was* purely `withPiece`'s — was
  taken, and that test is gone.
- *Assert the tray swatches are 44px on a phone.* Written, run, and then
  deleted: `docs/PLAN.md` holds that floor for the screens a Student meets, and
  Confirm & Edit is a Coach's. It also measured the wrong element — the input
  is inset by the swatch's 2px border, while the label around it is the real
  44px target.
- *Drop `router.invalidate()` from `/puzzles/$puzzleId`'s save, since the
  `navigate` one line later discards what it refetched.* True, and it costs a
  round trip on every edit — but the claim that `navigate` alone re-runs the
  Library's loader is untested, and if it is wrong a Coach renames a Puzzle
  and the Library still shows the old name. No test would catch that on the
  edit path. A wasted request beats a stale Library.
- *Give the disabled Save an `aria-describedby` pointing at the reasons, using
  `aria-disabled` so it stays focusable.* The reasons are on screen and the
  ticket's box is met; `aria-disabled` means writing the submit refusal by
  hand, which is the browser's job. It is in the tracker instead, triggered by
  a Coach who reads the screen rather than sees it.
