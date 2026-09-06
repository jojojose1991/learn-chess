# 29 — An unreachable Goal saves silently

**What to build:** A check at Save that the Goal is one the Position can
actually reach, so a Puzzle no Student can solve never reaches the Library.

`draftRefusal` (`src/lib/puzzles/service.ts`) validated the name, the Goal's
number range and the Position's legality, and then stopped. Nothing asked
whether "mate in N" was true of that board — `isCheckmate()` was reached from
exactly one place in the app, `evaluateGoal`, which runs at Play. So a legal
Position paired with any N saved cleanly, and the mismatch surfaced only to a
Student, as a board that refuses every tap once the budget runs out. The Coach
who saved it is not there to see it.

A Goal stays a predicate and no solution line is stored (ADR-0001): this proves
a forced mate exists, it does not record one.

**Blocked by:** nothing.

**Status:** resolved

- [x] A draft whose Goal the Position cannot reach is refused, in a sentence the Coach can read
- [x] A draft whose Goal it does reach is taken
- [x] A Goal more generous than the shortest mate is taken — the budget is a ceiling, not a distance
- [x] A Goal too deep to search is taken rather than refused on a search that never ran
- [x] The search finds a mate whose first move is quiet, not only forcing lines
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

**Red evidence.** Both layers were written test-first and seen red by
disabling the implementation: `hasNoMateWithin`'s cases in
`tests/lib/chess/goals.test.ts`, and the wiring assertion in
`tests/lib/puzzles/service.test.ts`, which fails with
`if (false && hasNoMateWithin(...))` and passes without it.

**Two defects the tests caught in the first attempt.** The search was
originally pruned to checking moves only, for speed. Both bugs were false
refusals — they blocked correct Puzzles, the worse of the two failure
directions:

1. A mating move's SAN ends `#`, never `+`, so mates were pruned whenever
   `n > 1`. A mate-in-1 Position saved as "mate in 2" was called unsolvable,
   and the verdict was non-monotonic in `n`.
2. A mate whose first move is quiet was missed entirely. Differential testing
   against a full-width oracle over random positions called 12 of 334
   mates-in-2 unsolvable. Taking the opposition or stepping a rook onto the
   file is the commonest shape a Coach sets, not a study.

The pruning was dropped for a sound full-width search.

**Why the ceiling is 2.** Full width is exponential: ~230ms at n=2 and ~5.9s
at n=3 on a busy Position with no mate in it, on a request a Coach waits on.
Above `SEARCH_CEILING` the search declines to answer rather than refusing, so
Goals of 3–10 are taken on the Coach's word and this check does not hold them.
That is the deliberate limit and the reason the row below exists.

**Findings applied from review.** The transposition cache was cut — it bought
~10% at a ceiling where transpositions are rare. `MateVerdict` was collapsed
from an exported three-state type to `hasNoMateWithin`, because its only
caller used one of the three states. A wall-clock timing assertion was deleted
rather than kept: it passed trivially (`n = GOAL_N_MAX` returns without
searching) and would have flaked on CI. The search's own rules moved down to
`tests/lib/chess/goals.test.ts`, leaving the service test to prove the wiring.

**Not the cause of the report that prompted it.** This was found while
troubleshooting `test-2`, a Coach's Puzzle that looked as though checkmate was
not being inferred. It was not: `6k1/5p2/1R4p1/1P2B3/6Pp/4PpnP/5K2/2r5 b - - 0 1`
has the unique mate `Rf1#`, `goal_n` of 1 is correct, and every layer —
validity, mate detection, `evaluateGoal`, the reducer, orientation — answers
correctly for it. `Nh1+` is check and not mate, since White escapes with the
only reply `Kxf3`. The hole this ticket closes is real and was found on the
way, but it is not that report's fix.
