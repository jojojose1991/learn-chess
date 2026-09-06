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

**Status:** ready-for-agent

- [ ] The setup repeated across the e2e specs lives in `tests/e2e/coach.ts`
- [ ] A helper is added only where two or more specs genuinely share it, not where they merely resemble each other
- [ ] `pnpm e2e` passes with the same test count as before, since this changes no behaviour
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
