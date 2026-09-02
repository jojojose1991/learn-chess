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

**Status:** resolved

- [x] `explainIllegal(fen, from, to)` returns one plain sentence, no chess jargon and no notation
- [x] Distinct explanations for: not your piece, no piece there, that piece cannot reach that square, and it would expose your own king
- [x] `evaluateGoal(goal, moves)` returns `open | solved | failed` for a `mate_in` Goal
- [x] Mate delivered within N of the Student's own moves is `solved`; mate on the move after the budget is `failed`
- [x] Only the Student's own moves count against N — the opponent's replies do not
- [x] Two different mating lines from the same Position both evaluate `solved`
- [x] Stalemate and draw by insufficient material are `failed`, distinguishably from a spent budget
- [x] No solution moves are stored or compared against anywhere
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

`explainIllegal` lives in `src/lib/chess/rules.ts` beside the other move logic;
`evaluateGoal`, the `Goal` type and `GoalOutcome` are in `src/lib/chess/goals.ts`,
because a Goal is a domain concept with its own extension axis (goal kinds) and
changes for different reasons than the rules do. 42 tests pass.

**How the two illegal-move reasons are told apart.** `chess.js` 1.4.0 has no
pseudo-legal move generator, and legal-move generation applies exactly one
filter on top of pseudo-legality: king safety. So removing the moving side's
king and re-generating gives pseudo-legal moves, and the same piece alone on a
cleared board gives pure movement shape. Both measured and written up in
`docs/learnings/chess-libraries.md`.

Order matters there: a pinned pawn's capture is a real capture, so it must be
recognised on the true board *before* the empty-board probe — where there is
nothing to capture — gets to call it bad pawn geometry. The first cut had this
backwards and explained a pin as "a pawn moves straight forward".

**Three explanations beyond the four asked for**, each because the required
four would otherwise have said something false to a six-year-old: "One of your
own pieces is already on that square", "There is a piece in the way" (a blocked
rook is not a rook that moves diagonally), and "Your king cannot castle right
now" (gated on the king standing on its home square, so a two-square king walk
elsewhere is still just an illegal king move).

**`evaluateGoal(goal, moves)` takes `Array<PlayedMove>`** — `{ fen, san }`,
exactly what a successful `applyMove` returns, so the game loop pushes the
result straight onto the list with no transformation. It reads only the last
`fen` and the array length: the Student moves first from the Puzzle's Position,
so the odd plies are theirs and `Math.ceil(length / 2)` is the budget spent.
No side is recorded per move, and none is needed. Nothing stores or compares a
solution line (ADR-0001).

A `failed` outcome carries a `reason`, which is what makes stalemate and
insufficient material distinguishable from a spent budget — screen 6 needs the
sentence anyway.
