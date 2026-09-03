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

**Status:** ready-for-agent

- [ ] A Coach switches theme and the board they are looking at changes
- [ ] The choice survives sign-out and sign-in, and follows them to another device
- [ ] A Puzzle Link minted afterwards carries the new theme, and one minted
      before still carries the old one — which closes ticket 11's open box
- [ ] A Student on a Puzzle Link is never offered the toggle; the link's theme wins
- [ ] The write goes controller → service → repository like every other, and no
      route reads `user.board_theme` out of a session by hand
- [ ] A test asserts the brown board renders, which 06 left owed because
      nothing could select it
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

Split out of the app-wide theming work, which deliberately stopped at the
chrome: warming the neutral palette, the typographic voice and the two
signed-out-and-Library screens is presentation and touches no layer below the
route. This is a persisted preference with a service and a repository write,
so it is its own trip through the loop.
