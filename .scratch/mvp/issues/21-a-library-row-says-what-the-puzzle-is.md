# 21 — A Library row says what the Puzzle is

**What to build:** A Puzzle is a Position plus a Goal, and the Library shows
only half of that. Every row is a bare name, so a Coach scanning for the mate
in two they set up last week has nothing to scan by. The row should say the
Goal in the same plain words the Play screen uses above the board.

The wording is a pure function over `Goal` and belongs in `src/lib/chess/`
beside `evaluateGoal` — `goals.ts` has the type and the evaluator and no way to
say a Goal out loud, which the Play screen (ticket 09) needs too. Write it once,
here, and let 09 use it rather than each screen phrasing `mate_in` its own way.

The rest is plumbing that does not exist yet: `listPuzzlesByCoach` selects
`{ id, name }`, and `LibraryPuzzle` is `{ id, name }`. Both widen by two
columns. Named fields, not the row — the repository's select is narrow on
purpose so a new column cannot reach the client without a type error, and that
property is worth keeping on the way past.

**Deliberately not in scope: a board thumbnail per row.** It is what makes
chess.com's and lichess's puzzle lists readable and it is the right answer
eventually, but the board is the hero of a screen and a 48px unreadable one is
not a smaller version of that. Revisit once 06 exists and it can be looked at.

**Blocked by:** nothing. 05 shipped the list; this widens it.

**Status:** resolved

- [x] A Goal renders as words a Coach reads at a glance, from one pure function
      in `src/lib/chess/`, tested there
- [x] Every Library row shows its Puzzle's Goal alongside the name
- [x] The repository still selects named columns, and the service still maps to
      an explicit DTO rather than returning a row
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

Found while scoping the app-wide theming, as the reason the Library looked
thin: its problem was informational, not visual, and no amount of palette
fixes a row with one field on it. Ticket 05 said "a flat named list — no
folders, no tags" and this does not contradict that: still flat, still one
line per Puzzle, no grouping.

**The wording is "Checkmate in 2 moves", not "Mate in 2".** One function serves
both this row and Play, and Play's own criterion is "plain words a child can
follow, not notation" — so the stricter reader sets it. It is also the voice
`evaluateGoal`'s failure reasons already answer in.

**A coverage loss review caught before it shipped.** Widening the row made
`toHaveText(["anastasia's mate", "Back rank mate"])` fail, and the first fix
was `toContainText`. That matcher's array form asserts no length and matches as
an ordered subsequence, so a leaked Puzzle from another Coach would have passed
— the half of the test its name promises. `toHaveCount(2)` now carries it
explicitly, and the matcher's real behaviour is in `docs/learnings/testing.md`.

**Review findings declined, with reasons:**

- _Fold the Goal e2e test into the ownership one._ A wording change should fail
  the test named for the wording, not the one named for whose Puzzles appear.
  One behaviour, one test; the cost is one sign-in.
- _Split `evaluateGoal` out so the Library route stops pulling chess.js._ Real
  and measured — 35 kB of shared chunk for two words. Declined here because the
  ticket puts the wording beside `evaluateGoal`, the Library is the way into a
  Coach area that 08 and 09 need chess.js on anyway, and a new file to dodge an
  unmeasured cost is the speculative move. Carried forward instead.
- _A CHECK constraint on `goal_kind`._ Nothing writes a second Goal kind yet
  and 08 owns the write path. Carried forward with the `describeGoal` half.
