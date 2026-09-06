# 28 — The board locators are copied into four e2e specs

**What to build:** One module for the board's accessible names.
`boardOf` is byte-identical in `board.spec.ts`, `engine.spec.ts`,
`play.spec.ts` and `puzzle-link.spec.ts`; `movesOf` and `square` are
identical in the first two of those. Ticket 26 hoisted the journeys and
deliberately left these, because `coach.ts`'s subject is the Coach's session
and these are not that.

They encode the names the app renders — `"Chess board"`, `"Moves"`, the
square's `aria-label` shape. Renaming any of them today is a four-file edit
found only by a red suite, which is the cost that makes this worth doing.

**Blocked by:** nothing.

**Status:** ready-for-agent

- [ ] The board locators shared by two or more specs live in one module under `tests/e2e/`
- [ ] `coach.ts` still holds only the Coach's session and the journeys through it
- [ ] `pnpm e2e` passes with the same test count, since this changes no behaviour
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
