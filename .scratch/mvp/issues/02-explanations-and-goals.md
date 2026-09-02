# 02 — Illegal-move explanations and Goal evaluation

**What to build:** Two more pure functions. When a Student tries something
illegal, the board can say why in a sentence a six-year-old can read — "A
knight moves in an L", "That would leave your king in danger", "That's not your
piece" — rather than silently refusing. And after any sequence of moves, a
Puzzle can say whether its Goal is still open, solved, or failed.

A Goal is a predicate over board state, never a stored solution line
(ADR-0001). Any line of play that brings checkmate about within N of the
Student's own moves solves the Puzzle; two different routes to the same mate
must both be accepted.

**Blocked by:** 01 — chess rules core.

**Status:** ready-for-agent

- [ ] `explainIllegal(fen, from, to)` returns one plain sentence, no chess jargon and no notation
- [ ] Distinct explanations for: not your piece, no piece there, that piece cannot reach that square, and it would expose your own king
- [ ] `evaluateGoal(goal, moves)` returns `open | solved | failed` for a `mate_in` Goal
- [ ] Mate delivered within N of the Student's own moves is `solved`; mate on the move after the budget is `failed`
- [ ] Only the Student's own moves count against N — the opponent's replies do not
- [ ] Two different mating lines from the same Position both evaluate `solved`
- [ ] Stalemate and draw by insufficient material are `failed`, distinguishably from a spent budget
- [ ] No solution moves are stored or compared against anywhere
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
