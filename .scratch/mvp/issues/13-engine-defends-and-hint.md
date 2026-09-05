# 13 — The engine defends, and Hint

**What to build:** The opponent. After each of the Student's moves the engine
replies, the move budget runs down, and when it is exhausted the Puzzle fails.
This is a full-strength defender; a deliberately weak mover is a different
implementation and is not being built.

The escape hatch is Hint, which highlights the piece that should move and never
the move itself.

**Blocked by:** 10 (Solved / Not this time) and 12 (Stockfish over UCI).

**Status:** resolved

- [x] After a Student move the engine replies with a legal move, appended to the SAN list
- [x] The board is not accepting taps while the engine is thinking, and says why
- [x] The Goal budget counts only the Student's own moves; the engine's replies do not consume it
- [x] A mate delivered against the defending engine within the budget still solves the Puzzle
- [x] Hint highlights one piece and nothing else — no destination square, no arrow, no notation
- [x] A failed engine request leaves the game playable and says something plain, rather than losing the position
- [x] Rule enforcement stays client-side: no legality check waits on a round trip
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

Built and reviewed 2026-09-05. The defender is three pieces: `playReducer`
takes the engine's ply, `PlayPuzzle` asks for one whenever the loop says it is
waiting, and `/api/engine/move` (ticket 12) is what it asks. Hint asks the same
engine and keeps only the `from` square.

**The budget was already right, and that is the point.** `evaluateGoal` counts
`ceil(plies / 2)`, so the odd plies are the Student's and a reply costs
nothing. Nothing in this ticket changed it; what changed is that the even
plies are now the engine's rather than the person at the board playing both
sides.

**Waiting on the engine is derived, not stored.** `engineThinking(state)` is
"the Goal is open, an odd number of plies is played, and the engine has not
already failed" — the same parity the budget is counted by, so the two cannot
drift into two answers about whose turn it is.

**Both engine actions name the Position they are about.** A reply or a timeout
for a Position the game has left is dropped by the reducer rather than played
on the board in front of it. That is not enough on its own — a Rewind and a
replay of the same move ask twice about the _same_ Position — so the effect
also abandons its own request on cleanup. Both were needed; each was seen red
with the other in place.

**Rewind takes back the pair.** It was one ply, which was one of the Student's
only while both sides were theirs; the carried-forward row saying so named 13
as its trigger and is now gone from `docs/TRACKER.md`. Three tests went with
it: two in `tests/lib/chess/play.test.ts` whose premise was local-versus-local,
and "hands the turn over once a move lands", which could no longer be reached
because the turn now goes to the engine. Announced here rather than only in the
commit, because changing a test is a decision and not a detail.

**A failed engine request hands the board back.** The Position is not lost, and
the person at the board can play the reply themselves — which is exactly how
Play worked before this ticket, so the failure mode is the old behaviour rather
than a new one. A retry button would be the alternative; nothing yet says one
is wanted.

**A locked board says so on all 64 squares.** `aria-disabled`, not `disabled`,
so the squares stay in the tab order and a Student who reads the screen can
still be told what is on them — the same lesson as the Save button the tracker
already owes. This closed the row about a finished attempt whose board still
picked pieces up.

**Hint is the screen's, not the loop's.** It changes no rule, no history and no
Goal, so it is `useState` next to Guidance. It is paired with the Position it
was asked about, _and_ cleared on every move — the pairing alone let a hint
reappear on Try again, which lands back on the very Position it was asked
about.

**Hint is inert while the board is.** `docs/PLAN.md` has the Solved / Not this
time banner offering Hint; the control is still there, and it is disabled
exactly when the board is locked. A hint you cannot pick up is not an escape
hatch, and on a Position that is over the engine has no move to name — which
was printing "The engine could not pick a piece" underneath "Solved!".

**Three defects the reviews caught, each fixed with a test seen red.** A stale
timeout blaming a search that was still running; a hint returning with the
Position on Try again; and Hint left live on a finished board. The turn line
was also reading a Position nothing held it to — `whiteToMove(game.start)`
passed the whole suite until the engine-quiet test named the side.

**Findings declined, with reasons:**

- _Merge `engineFailure` into `refusal`._ They are different actors and read
  differently — a refusal is the Student's mistake in destructive ink, the
  engine going quiet is not their mistake at all — and merging would make the
  board's lock depend on the last illegal tap.
- _Delete the screen's Rewind test as the reducer's replayed through HTML._
  Both reviews said it; it stays because it is the only thing that fails when
  the Rewind button is wired to `reset`. One ply cannot tell the two apart, so
  it takes three.
- _Reuse the defender's sentence for a failed Hint._ "Play its move yourself"
  is untrue when it is the Student's turn and no move is owed.
- _Drop the reducer test that rewinds a single unanswered move._ It is the only
  one that fails a plausible "do not rewind while the engine is thinking".
- _`aria-disabled` on the promotion picker's own buttons._ `promote()` bypasses
  the lock, but nothing flips it while the dialog is open, so the branch is
  unreachable.
- _Tell the route's 409 and 422 apart from a dead engine._ Both are impossible
  on the defender's path, which only asks about an open, legal Position, and on
  Hint's path "could not pick a piece" is what a 409 means anyway.

**What is not held by a test.** The hinted piece is dashed and a selected one
is washed, which is the only thing telling a sighted Student the two apart —
asserting it means asserting a class string, so it is held by review, as
ticket 10 holds "no animation". The engine request has no client-side timeout;
that one is a row in `docs/TRACKER.md` with its trigger.

**The e2e journey is written and unrun.** `tests/e2e/engine.spec.ts` holds the
two claims nothing below a browser can make: a real Stockfish answering over
the real route into the move list, and Hint marking one piece with no
destination anywhere. An agent in a worktree cannot run `pnpm e2e` — the port
and the e2e database are shared with the other worktrees in flight — so it has
never gone green or red. It skips where `STOCKFISH_PATH` is unset, like ticket
12's real-engine test. The orchestrator's run is where it first speaks.
