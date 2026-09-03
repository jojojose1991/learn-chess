# 10 — Solved / Not this time

**What to build:** The end of an attempt. The Goal is evaluated after each move
and the outcome is a static banner — no animation, no score, no red X. Not
solved rewinds to the starting Position and offers another go. Stalemate and
draws get a one-line plain-English explanation rather than a bare "draw".

**Blocked by:** 09 (Play).

**Status:** ready-for-agent

- [ ] Reaching checkmate within the move budget shows the solved banner
- [ ] Exhausting the budget without mate shows "Not this time" and rewinds to the start
- [ ] Stalemate and draw by insufficient material each explain themselves in one plain sentence
- [ ] The banner is static — no animation anywhere in the outcome
- [ ] No score, rating, star count or red X appears
- [ ] After an unsuccessful attempt the Puzzle is immediately playable again from the start
- [ ] The banner and its buttons are usable at 390px, 820px and 1280px, with no sideways scrolling
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
