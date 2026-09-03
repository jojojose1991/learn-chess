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

**Status:** ready-for-agent

- [ ] A Goal renders as words a Coach reads at a glance, from one pure function
      in `src/lib/chess/`, tested there
- [ ] Every Library row shows its Puzzle's Goal alongside the name
- [ ] The repository still selects named columns, and the service still maps to
      an explicit DTO rather than returning a row
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

Found while scoping the app-wide theming, as the reason the Library looked
thin: its problem was informational, not visual, and no amount of palette
fixes a row with one field on it. Ticket 05 said "a flat named list — no
folders, no tags" and this does not contradict that: still flat, still one
line per Puzzle, no grouping.
