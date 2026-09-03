# 06 — The board renders a Position

**What to build:** The board, as the hero of every screen it appears on. Given
a Position it draws where every piece stands, in either theme, with coordinates
always shown. It renders a Position and emits taps, and it knows nothing about
Goals, engines or games — which is what makes it usable unchanged on all six
screens including the editor.

Themes are green `#779952` / `#edeed1` (default) and brown `#b58863` /
`#f0d9b5`. The highlight colour is reserved, so nothing saturated appears yet.

Rendered against hardcoded Positions; no data layer involved.

**The artwork is settled, and the licence election is part of the work**
(ADR-0004). Use Cburnett's twelve Wikimedia Commons SVGs, vendored into
`public/pieces/` unmodified, **elected under BSD 3-Clause** — the Commons
original is multi-licensed and the election is ours to make and ours to record.
Do not take this art from an npm package: `react-chessboard` and
`chessboard-element` ship it with no attribution at all, `react-chess-pieces`
relicensed a BY-SA-only derivative as ISC, and chessground base64s it into
GPL-3.0 CSS. Do not substitute a better-looking set by eye — `staunty`,
`maestro`, `fresca`, `cardinal`, `gioco`, `tatiana`, `dubrovny`, `icpieces`,
`california` and `caliente` are every one CC BY-NC-SA 4.0. The fallback, if
Cburnett's shapes prove wrong for five-year-olds, is `chessnut` under Apache
2.0.

Because BSD-3 permits inlining, the pieces may go through SVGR into components
if that is convenient; a GPL election would have forbidden it.

The attribution obligation ships with the art rather than at deploy time —
hence the notices and `/credits` below. BSD §3 also forbids using Burnett's
name to promote the app: crediting him on a notices page is required, "Chess
pieces by Cburnett!" on the landing page as an endorsement is not.

**Blocked by:** 01 — chess rules core.

**Status:** resolved

- [x] A 64-square grid with Cburnett's Staunton SVG pieces, driven by a Position passed in
- [x] The twelve SVGs are vendored into `public/pieces/`, unmodified, not pulled from an npm package
- [x] `public/pieces/LICENSE` carries the full BSD 3-Clause text
- [x] `THIRD_PARTY_NOTICES.md` at the repo root names the election explicitly — multi-licensed under GFDL 1.2+, CC BY-SA 3.0, BSD 3-clause and GPLv2+, used here under BSD 3-clause
- [x] A `/credits` route shows the same notice and is reachable from the app
- [x] Cburnett's name appears nowhere that reads as an endorsement of the app
- [x] File and rank coordinates always visible, in both orientations
- [x] Flipping to Black's perspective reverses the board and the coordinates together
- [x] Both themes render, selectable by prop, green as the default
- [x] The board stays square at every viewport width and never shrinks to make room for anything beside it
- [x] Tapping a square emits it; the component holds no chess knowledge of its own
- [x] `environment: "jsdom"` added to the Vitest config so DOM tests can run
- [x] A rendering test asserts a known Position puts the right pieces on the right squares
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

Built and reviewed 2026-09-03. Two commits: the artwork and its licence, then
the board itself.

**A defect the board exposed, fixed with it.** `mx-auto` on a flex-column
child shrinks to fit its content, so every Coach screen's `max-w-*` silently
meant "as narrow as its text" and the hero drew at 131px. `src/routes/_coach.tsx`
now gives the `Outlet` a block wrapper. Seen red at 131.36px with the fix
reverted, while both squareness assertions still passed — 131 by 131 is square,
which is why "fills the width its screen allows" is its own test.

**Three gaps a reviewer found by mutation, now closed.** `isLight` returning a
constant, the theme class pointing at the wrong palette, and every piece
drawing in the opposite colour all left the unit suite green. Three e2e
assertions in `tests/e2e/board.spec.ts` cover them, each verified red against
its own mutation. The two hex pairs are this issue's own product decision, so
asserting them is asserting the spec rather than a design token.

**Review findings declined, with reasons:**

- *`wK.svg` came from lichess' GPL-elected copy.* Disproven. A Commons editor
  ran that one file through SVGOMG **on Commons** in 2022; our copy is
  byte-identical to what `Special:FilePath` serves today. Evidence and the
  file's `imageinfo` history are in `docs/learnings/piece-assets.md`.
- *`readPlacement` throws on a placement-only FEN.* True, and unreachable: a
  FEN reaching the board comes from the database or the editor, both of which
  have validated it, and the Scan path composes a full FEN (ADR-0002). Guarding
  here would move validation off the boundary that owns it.
- *`BoardTheme` should not be imported from `@/db/schema`.* The import is
  `import type`, erased at build — `pnpm build` confirms no drizzle in
  `dist/client`. It also flows controller → repository, which is the allowed
  direction; the alternatives are a new module for one type, or a `db` file
  importing a component. One definition matters more, because the Coach's
  stored theme and this prop must not drift.
- *Restore `Record<BoardTheme, string>` for exhaustiveness.* The stated failure
  — a garbage `board_theme` row rendering 64 transparent squares — happens
  identically with the `Record`, since the lookup is `undefined` either way.
  That hole is a missing CHECK constraint, not a missing object literal.
- *Rename `public/pieces/LICENSE` to `.txt` so the credits link renders.* The
  filename is ADR-0004's and this issue's; changing it is an ADR revision, not
  a review fix. The notice itself is on the page, so the link is a pointer to
  the full text and a download of it is not a failure.
- *Give `/credits` a way back.* Browser back is the affordance for a leaf
  notices page, and a Library link would mislead a Student on a Puzzle Link who
  has no Library.
- *`inert` the placeholder board's 64 no-op buttons.* `inert` removes content
  from the accessibility tree, so it would hide the board from a screen reader
  entirely — worse than dead tab stops on a screen 08 replaces.
- *`fen` as a prop name, when `CONTEXT.md` rejects FEN as a synonym for
  Position.* `src/lib/chess/rules.ts` already names its parameters `fen`;
  changing the convention is a rename across the domain, not this issue.

**Two checklist items with no honest test, deliberately:**

- *Brown renders.* Nothing selects it yet — the Coach's stored theme is wired
  later — so an assertion would only prove the CSS exists. Verified by eye in
  Chromium instead. Green, which is the default and is on screen, is asserted.
- *Never shrinks to make room for anything beside it.* Nothing sits beside the
  board until the move list arrives in 09. That is the screen's `shrink-0`, not
  the component's, and belongs to the commit that adds it.

Coordinate contrast changed on review: the labels took each square's opposite
colour, measuring 2.75:1 on green and 2.29:1 on brown against AA's 4.5. One
dark colour on all four square fills clears it at 5.1:1 worst case and drops a
conditional.
