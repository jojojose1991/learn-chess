# 20 — A Coach picks their board theme

**What to build:** The only thing that writes `user.board_theme`. A Coach
switches between the green and brown boards, it survives sign-out, and the
board they teach on is the one stamped onto every Puzzle Link they mint after.

The column already exists — `src/db/schema.ts`, `boardTheme` in
`src/lib/auth.ts` additionalFields, defaulting to `green` in
`src/db/auth-schema.ts` — and ticket 06 shipped both themes as the
`.board-green` / `.board-brown` classes over `--board-light` and
`--board-dark`. What is missing is any way for the value to become `brown`.
Today it is written-never, which is also why ticket 11's "changing the Coach's
theme afterwards does not change an already-minted link" cannot be ticked:
nothing in the product can change it.

This is the ticket the tracker's *"Only green is asserted — nothing selects
brown yet"* row was waiting for, so that row becomes this one's last box and
leaves `docs/TRACKER.md`.

**Not a settings screen.** PLAN's screens list has seven and none of them is
settings; a whole route, a nav entry and a design-doc amendment for one
two-state value is not a trade worth making. A toggle where the board already
is, writing through on change. Where exactly — beside the board, or in the
sidebar footer next to the sign-out — is the implementer's call once 06 exists
and there is something to stand next to.

This is the one Coach-facing preference, so it does not earn a preferences
service, a settings table or a generic key-value store. One column, one write.

**Blocked by:** nothing. 06 resolved, so both themes are on screen and there is
something to choose between.

**Status:** resolved

- [x] A Coach switches theme and the board they are looking at changes
- [x] The choice survives sign-out and sign-in, and follows them to another device
- [ ] A Puzzle Link minted afterwards carries the new theme, and one minted
      before still carries the old one — which closes ticket 11's open box
- [ ] A Student on a Puzzle Link is never offered the toggle; the link's theme wins
- [x] The write goes controller → service → repository like every other, and no
      route reads `user.board_theme` out of a session by hand
- [x] A test asserts the brown board renders, which 06 left owed because
      nothing could select it
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

Split out of the app-wide theming work, which deliberately stopped at the
chrome: warming the neutral palette, the typographic voice and the two
signed-out-and-Library screens is presentation and touches no layer below the
route. This is a persisted preference with a service and a repository write,
so it is its own trip through the loop.

**Two boxes stay open, and both wait on 11.** Nothing mints a Puzzle Link yet
— `puzzle_link` is a table no code writes — so neither "a link minted
afterwards carries the new theme" nor "the link's theme wins" can be asserted
without inventing the screen that would prove them. What 11 was owed is
delivered: the value it stamps can now be something other than `green`, and
the toggle lives inside the `_coach` sidebar, which a Student never renders.
`docs/TRACKER.md` carries the row.

The tracker's *"Only green is asserted — nothing selects brown yet"* row had
already left the file in `0f5ce3c`, so there was nothing to retire. The
assertion it was waiting for is `tests/e2e/theme.spec.ts`, which picks brown,
reads the two hex pairs back off the squares, and signs out and in again to
prove the choice is a column and not a cookie.

**Review findings declined, with reasons:**

- *Fold `src/lib/board-theme/` into `src/lib/accounts/`.* Every function in
  that module is admin-gated and its whole surface is the Accounts screen. A
  self-service write sitting among four gated ones invites the next reader to
  add the check that does not belong, or to skip the one that does. Two files
  of fifteen lines is the cheaper mistake.
- *Reuse the mock harness in `tests/lib/accounts/service.test.ts`.* Follows
  from the fold, and declined with it.
- *Delete `boardThemeOf` and inline it into `getCoach`.* It is a one-caller
  wrapper, but inlining moves the green fallback — the mitigation for the
  missing CHECK constraint — inside `getCoach`, which no unit test reaches
  without mocking better-auth. The seam is the only reason that branch is
  held.
- *`disabled` on the button for the theme already in force.* It would drop
  that button out of the tab order and move the state out of `aria-pressed`,
  which already carries it; the redundant write it saves is idempotent.
- *Strike "which closes ticket 11's open box" from the criterion.* The
  criterion is the ticket's own spec text, and the two boxes stay unticked
  because it is not met. Editing a spec to agree with what shipped is how it
  stops being one.

Cut or fixed on review: a service test that re-walked the write with the
other theme (nothing branches on which), two comments longer than the code
under them, and three races in `tests/e2e/theme.spec.ts` — a click before
hydration, a sign-out that could overtake the write it was there to prove,
and an unawaited restore to green.
