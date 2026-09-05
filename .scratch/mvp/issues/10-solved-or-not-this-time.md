# 10 — Solved / Not this time

**What to build:** The end of an attempt. The Goal is evaluated after each move
and the outcome is a static banner — no animation, no score, no red X. Not
solved offers the go that rewinds to the starting Position. Stalemate and
draws get a one-line plain-English explanation rather than a bare "draw".

**Blocked by:** 09 (Play).

**Status:** resolved

- [x] Reaching checkmate within the move budget shows the solved banner
- [x] Exhausting the budget without mate shows "Not this time" and offers the go that rewinds to the start
- [x] Stalemate and draw by insufficient material each explain themselves in one plain sentence
- [x] The banner is static — no animation anywhere in the outcome
- [x] No score, rating, star count or red X appears
- [x] After an unsuccessful attempt the Puzzle is immediately playable again from the start
- [x] The banner and its buttons are usable at 390px, 820px and 1280px, with no sideways scrolling
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

Built and reviewed 2026-09-05. The outcome is `evaluateGoal`'s, said out loud
by `PlayPuzzle`: `evaluateGoal(goal, start, moves)` now judges the Position a
Puzzle starts from, `playReducer` takes no move once the Goal has closed, and
the turn line's slot holds "Solved!" or "Not this time" with the Goal's own
sentence under it.

**The stalemate sentence changed.** It said "the other side has no legal
move", which is true only when the Student's own move caused it — false in a
stored stalemate, and false when the reply causes one. It now says "the player
to move", which holds in all three.

**A closed attempt takes no more moves, including a spent budget.** PLAN's
"a legal but losing move is allowed to happen" governs an attempt still
running. One rule in the reducer beats two, and it is what stops a Position
stored in checkmate answering every tap with "That would leave your king in
danger."

**"Try again" is an affordance, not an automatic reset.** Resetting on failure
would erase the banner in the same tick it appeared. The button dispatches the
existing `reset` — no new action, no `finished` flag, nothing `status` does not
already say.

**No test holds "no animation".** Asserting it means asserting a class string
or a computed style, which couples the suite to styling and would pass with the
bug present. Nothing in the outcome animates; that is held by review, as the
absence of dragging is held by lint.

**Declined: hiding Reset while the banner stands, because Try again is the
same action.** `docs/PLAN.md` lists Reset as one of Play's permanent controls,
and Rewind beside it is not the same action — it takes back one ply and reopens
the Goal, which is the useful thing to do after a failure. Try again is the
same action offered where a five-year-old is already looking, and the two names
say which is which.

**Declined: dropping `const outcome = game.status`.** It saves a line and costs
six readings of `game.status.status`.

**Left to the orchestrator: `docs/TRACKER.md`'s header count.** Two agents were
building in parallel and both editing that one line guarantees a conflict, so
it is set at merge.
