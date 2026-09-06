# 30 — The defender never answers a lost attempt

**What to build:** The defender's reply to a move that lost the Puzzle, so a
Student can see what refuted them.

`engineThinking` gated on `status.status === "open"`, so the moment a Student's
move closed the Goal the engine was never asked. On a mate-in-1 that is every
wrong move: the board froze with "Not this time", the refuting reply was never
played, and it never reached the moves panel either. The Student is told they
are wrong and denied the evidence.

This reverses ticket 10's "a closed attempt takes no more moves", which applied
one rule where `docs/PLAN.md` has two — "the engine defends, the move budget
runs down, and when it is exhausted the Puzzle fails" — and against PLAN's own
reason for letting a losing move happen at all: "it robs the Student of finding
out why it failed". Ticket 10's note is amended rather than left to contradict
this.

What ends the loop is the board having no legal move left — checkmate,
stalemate or a draw. Those need no reply and have none to give, so the same
rule that lets a lost attempt be answered still keeps a solved one silent.

**Blocked by:** nothing.

**Status:** resolved

- [x] A move that loses the Puzzle on a live board is still answered by the defender
- [x] The refutation reaches the moves panel like any other reply
- [x] The attempt stays failed once answered — a reply is not a reprieve
- [x] A Student's tap is still refused once the Goal has closed, answered or not
- [x] A Goal closed by checkmate, stalemate or a draw asks for no reply
- [x] The outcome is not said until the refutation has landed, so no verdict names a move nobody has seen
- [x] A draw by the fifty-move rule closes the attempt, so the gate and the Goal agree on what "over" means
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

**Red evidence.** The reducer's cases in `tests/lib/chess/play.test.ts` and the
screen's in `tests/components/play-puzzle.test.tsx` were written first and seen
red against the old `status.status === "open"` gate.

**One test was rewritten, and announced before the edit rather than in the
commit that carries it.** "plays nothing more once the budget is spent" encoded
exactly the rule being reversed, so it became "still lets the defender answer a
spent budget". Two others changed shape rather than meaning: "says why an
attempt ended" now needs an `askEngine` where it needed none, because the
outcome now waits on a reply, and its reason changed from a spent budget to
insufficient material — `Kxg8` takes the queen, and the Goal says whichever is
true.

**The verified case that made the gate right.** `hasMoveLeft` is
`!isGameOver()`, which covers all three terminal ways at once. Measured on the
Coach's own `test-2`: `Rf1#` solves and the engine is never asked; `Nh1+` fails
and is answered `Kxf3`, both plies in the panel, further taps ignored, Rewind
reopening the Goal.

**Cheap checks first.** `engineThinking` runs on every render, so the parity
and failure-flag reads are ordered ahead of standing a board up. ~17µs a call
either way, which is why the order is the whole of the fix rather than a cache.

**Review caught a regression this introduced, and it is fixed here.** Gating on
the board rather than the Goal made two predicates read the same board: the
Goal knew checkmate, stalemate and insufficient material, `isGameOver()` also
knows the fifty-move rule. A quiet move that drew on the fiftieth left the Goal
`open` and the board over — so the engine was never asked, the board never
locked, no outcome appeared, and the person at it could play the defender's own
move as an uncounted ply. Only Rewind escaped, and nothing said so. The old gate
had failed loudly here instead, as an engine that could not answer.

`evaluateGoal` now has the branch, so the two agree on all four terminal states.
Threefold is the one draw still missing and cannot be added: it is
path-dependent, and a Puzzle starts from a FEN with no history behind it.

**Also from review: nothing held the other half of the gate.** Deleting the
board check left every test green, because a solved attempt is refused a second
ply further down anyway. "asks the defender nothing about a Position with no
move left in it" is the test that fails without it.