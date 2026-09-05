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

**Status:** resolved

- [x] Opening a saved Puzzle from the Library starts it at its stored Position
- [x] The Goal reads as plain words a child can follow, not notation
- [x] Legal moves apply and append to the SAN move list, both sides moved locally
- [x] An illegal attempt shows its plain-English reason and leaves the piece where it was
- [x] A legal but losing move is accepted with no warning of any kind
- [x] Rewind takes back one of the Student's moves; Reset returns to the starting Position
- [x] The Guidance toggle behaves exactly as on the board component, and its state is visible
- [x] The move list sits to the right of the board from ~900px up and collapses to a horizontally-scrolling strip beneath it when narrower, with the board never shrinking
- [x] The reducer is tested directly over a sequence of moves
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

Built and reviewed 2026-09-05. `src/lib/chess/play.ts` is the loop —
`startPlay` and `playReducer` over `{ start, fen, moves, goal, status,
refusal }`; `PlayPuzzle` is the screen and `/play/$puzzleId` the route.
`status` is computed here and shown nowhere: announcing Solved is 10's.

**Rewind takes one ply, not two.** Both sides are moved by the person at the
board, so the last ply *is* one of the Student's. When 13's engine answers
every move it has to drop the pair or the engine simply moves again; that is
a carried-forward row with 13 as its trigger.

**Play on Confirm & Edit writes the Puzzle first.** The alternative — a Play
control that opens the *stored* Position while the Coach looks at edits they
have not saved — is a worse lie than a redundant write, and writing first is
what makes "play is blocked while the Position is invalid" exactly Save's own
gate rather than a second one to keep in step.

**Declined: a promotion dispatched with no piece names the wrong reason.**
`explainIllegal` calls it "That would leave your king in danger." No caller
can dispatch one — `MoveBoard` opens the picker first and Escape clears it
without emitting — and the row for it is already owed from ticket 01.

**Declined: a refusal outlives the attempt it explains.** Putting the piece
back down or picking up another one leaves the last reason on screen. It is
still true about the move that was tried, and clearing it would mean the
board telling the screen about selections it deliberately keeps to itself.
