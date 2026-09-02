# 01 — Chess rules core: validate, legal targets, apply move

**What to build:** The pure rules layer everything else leans on. Given a
Position, a person can be told whether it is legal and why not; given a
selected square, which squares that piece may move to; given a move, the
Position that results and its SAN. No UI, no I/O, no React — this is the layer
that carries tests.

`validatePosition` wraps `chess.js`'s `validateFen` and adds what it does not
check: exactly two kings, no pawn on rank 1 or 8, the side *not* to move is not
in check, at most 8 pawns a side.

> **Corrected while building this** — `validateFen` 1.4.0 already rejects the
> first two. Only the pawn ceiling and the waiting-side check are ours. All
> four are still tested, as the acceptance criteria ask.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] `validatePosition(fen)` returns `ok`, or a list of human-readable reasons
- [x] Each of the four extra invariants above is rejected, with a test per invariant
- [x] A Position with castling rights or an en-passant square round-trips unchanged
- [x] `legalTargets(fen, square)` returns the destination squares, empty for an empty square or an opponent's piece
- [x] `legalTargets` includes castling and en-passant destinations where available
- [x] `applyMove(fen, from, to, promotion?)` returns `{ fen, san }`, or a rejection for an illegal move
- [x] `applyMove` rejects a move that would leave the mover's own king in check
- [x] No import of React, a framework, or anything doing I/O anywhere in the module
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

Implemented in `src/lib/chess/rules.ts` with `rules.test.ts` alongside it
(21 tests). `chess.js@1.4.0` added as a dependency.

Two corrections to `docs/learnings/chess-libraries.md` and `docs/PLAN.md`,
now folded back into both: `validateFen` in 1.4.0 **does** reject wrong king counts and pawns
on the edge rows, so only two of the four extra invariants are ours to add —
the pawn ceiling, and the waiting side already being in check. The tests still
cover all four, since the ticket asks for a test per invariant.

Also measured: `fen()` drops the en-passant square when no capture can
actually be made, so `applyMove(start, "e2", "e4")` returns `- 0 1`, not
`e3 0 1`. A Position keeping castling rights, or an en-passant square a pawn
can really use, does round-trip byte for byte.

`move({ from, to })` **throws** on a promoting move with no `promotion` given
rather than defaulting to a queen, so `applyMove` rejects it. The rejection
reason is deliberately the same sentence as any other illegal move: the board
component knows a pawn is reaching the last rank from `legalTargets` and opens
the picker *before* calling `applyMove`, so ticket 07 never needs to tell the
two apart. Give the promotion case its own reason only if something is found
that actually needs it.
