# 07 — Tap-tap moves, Guidance, and the promotion picker

**What to build:** Moving a piece. Tap a piece, tap a square — no dragging
anywhere, including the editor, because a five-year-old on a touchscreen drags
badly.

Guidance is a toggle. On, tapping a piece marks its legal destination squares.
Off, nothing is marked and the Student must find legal moves unaided. Either
way an illegal move is rejected outright and the piece does not move — Guidance
only changes whether the legal squares are shown *before* the attempt.

A pawn reaching the last rank asks which piece, as four large buttons with
Queen first and biggest.

**Blocked by:** 06 — the board renders a Position.

**Status:** ready-for-agent

- [ ] Tapping a piece selects it visibly; tapping a destination emits that move
- [ ] Tapping the selected piece again deselects; tapping another of your pieces moves the selection
- [ ] Tapping an empty square or an opponent's piece with nothing selected does nothing
- [ ] With Guidance on, selecting a piece marks exactly its legal destinations
- [ ] With Guidance off, selecting a piece marks nothing, and an illegal attempt is still refused with the piece unmoved
- [ ] The last move is shown, in the same reserved highlight colour as Guidance
- [ ] A promoting pawn opens four buttons, Queen first and largest, and the chosen piece appears
- [ ] No drag handler exists anywhere in the component
- [ ] Every tap target, the promotion buttons included, is at least 44px on a side at 390px wide
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
