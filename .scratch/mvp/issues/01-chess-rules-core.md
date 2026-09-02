# 01 — Chess rules core: validate, legal targets, apply move

**What to build:** The pure rules layer everything else leans on. Given a
Position, a person can be told whether it is legal and why not; given a
selected square, which squares that piece may move to; given a move, the
Position that results and its SAN. No UI, no I/O, no React — this is the layer
that carries tests.

`validatePosition` wraps `chess.js`'s `validateFen` and adds what it does not
check: exactly two kings, no pawn on rank 1 or 8, the side *not* to move is not
in check, at most 8 pawns a side.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `validatePosition(fen)` returns `ok`, or a list of human-readable reasons
- [ ] Each of the four extra invariants above is rejected, with a test per invariant
- [ ] A Position with castling rights or an en-passant square round-trips unchanged
- [ ] `legalTargets(fen, square)` returns the destination squares, empty for an empty square or an opponent's piece
- [ ] `legalTargets` includes castling and en-passant destinations where available
- [ ] `applyMove(fen, from, to, promotion?)` returns `{ fen, san }`, or a rejection for an illegal move
- [ ] `applyMove` rejects a move that would leave the mover's own king in check
- [ ] No import of React, a framework, or anything doing I/O anywhere in the module
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
