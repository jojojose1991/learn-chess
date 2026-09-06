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

**Status:** resolved

- [x] The board locators shared by two or more specs live in one module under `tests/e2e/`
- [x] `coach.ts` still holds only the Coach's session and the journeys through it
- [x] `pnpm e2e` passes with the same test count, since this changes no behaviour
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

The ticket said `square` was identical in `board.spec.ts` and the others. It
is not: `board.spec.ts` matched the whole label exactly, while `engine` and
`play` matched the coordinate as a prefix. Merging them would have made the
artwork assertions pass with the wrong piece on the square, so both survive —
`square` by coordinate and `squareExactly` by whole label.

`trayOf` and `themesOf` came along because the same names were inlined in
`puzzles.spec.ts`, `scan.spec.ts` and `theme.spec.ts`, which the ticket did
not count.

`puzzle-link.spec.ts` keeps `boardLive`, which passes `[aria-label="Chess
board"]` to `hydrated`. That is a CSS selector rather than a Locator, so it is
a different kind of thing and not this module's.
