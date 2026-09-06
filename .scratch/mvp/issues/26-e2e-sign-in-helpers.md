# 26 — The e2e suites each carry their own sign-in

**What to build:** One set of helpers for the journeys.
`tests/e2e/coach.ts` exports `signIn` alone, and ten spec files repeat the
setup around it. Ticket 13's review found this and judged it right on the
merits; it was declined only because two other worktrees were editing that
file at the time, and that reason expired when they were removed.

Hoist what repeats — not what happens to look alike. `eslint.config.js`
ignores `tests/e2e/**`, so nothing here is enforced by lint and the shape is
whatever the last author left.

**Blocked by:** nothing.

**Status:** resolved

- [x] The setup repeated across the e2e specs lives in `tests/e2e/coach.ts`
- [x] A helper is added only where two or more specs genuinely share it, not where they merely resemble each other
- [x] `pnpm e2e` passes with the same test count as before, since this changes no behaviour
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

`theme.spec.ts`'s `newPuzzle` was left where it is: it waits on the theme
buttons rather than the form, because those have no non-JS fallback, and it
omits `signIn` because the test calls it twice around a sign-out. That is the
"merely resemble each other" case this ticket warns about.

`addPuzzle` went to `tests/e2e/puzzle.ts` rather than `coach.ts` — it is a
database fixture, and `coach.ts`'s subject is the Coach's session.

The locators `boardOf`, `movesOf` and `square` are still duplicated across
four specs. They encode the app's accessible names rather than a journey, so
they belong in a board module of their own; ticket 28 has them.
