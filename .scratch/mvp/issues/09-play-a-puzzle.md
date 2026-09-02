# 09 — Play a Puzzle, local versus local

**What to build:** The Play screen, with both sides moved by the person at the
board. The Goal in plain words above it, whose turn it is, the moves so far in
SAN, and Reset and Rewind. Guidance is a toggle here too.

The game loop is one reducer over `{ fen, moves, goal, status }`.

A legal but losing move is allowed to happen. Nothing interrupts a legal move
to say it was wrong — that needs an analysis engine and it robs the Student of
finding out why it failed. An illegal move, by contrast, is refused with its
reason.

**Blocked by:** 08 (Confirm & Edit) and 02 (illegal-move explanations).

**Status:** ready-for-agent

- [ ] Opening a saved Puzzle from the Library starts it at its stored Position
- [ ] The Goal reads as plain words a child can follow, not notation
- [ ] Legal moves apply and append to the SAN move list, both sides moved locally
- [ ] An illegal attempt shows its plain-English reason and leaves the piece where it was
- [ ] A legal but losing move is accepted with no warning of any kind
- [ ] Rewind takes back one of the Student's moves; Reset returns to the starting Position
- [ ] The Guidance toggle behaves exactly as on the board component, and its state is visible
- [ ] The move list sits to the right of the board from ~900px up and collapses to a horizontally-scrolling strip beneath it when narrower, with the board never shrinking
- [ ] The reducer is tested directly over a sequence of moves
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
