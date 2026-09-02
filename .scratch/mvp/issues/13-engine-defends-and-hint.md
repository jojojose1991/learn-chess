# 13 — The engine defends, and Hint

**What to build:** The opponent. After each of the Student's moves the engine
replies, the move budget runs down, and when it is exhausted the Puzzle fails.
This is a full-strength defender; a deliberately weak mover is a different
implementation and is not being built.

The escape hatch is Hint, which highlights the piece that should move and never
the move itself.

**Blocked by:** 10 (Solved / Not this time) and 12 (Stockfish over UCI).

**Status:** ready-for-agent

- [ ] After a Student move the engine replies with a legal move, appended to the SAN list
- [ ] The board is not accepting taps while the engine is thinking, and says why
- [ ] The Goal budget counts only the Student's own moves; the engine's replies do not consume it
- [ ] A mate delivered against the defending engine within the budget still solves the Puzzle
- [ ] Hint highlights one piece and nothing else — no destination square, no arrow, no notation
- [ ] A failed engine request leaves the game playable and says something plain, rather than losing the position
- [ ] Rule enforcement stays client-side: no legality check waits on a round trip
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
