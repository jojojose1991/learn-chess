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

**Status:** ready-for-agent

- [ ] A 64-square grid with Cburnett's Staunton SVG pieces, driven by a Position passed in
- [ ] The twelve SVGs are vendored into `public/pieces/`, unmodified, not pulled from an npm package
- [ ] `public/pieces/LICENSE` carries the full BSD 3-Clause text
- [ ] `THIRD_PARTY_NOTICES.md` at the repo root names the election explicitly — multi-licensed under GFDL 1.2+, CC BY-SA 3.0, BSD 3-clause and GPLv2+, used here under BSD 3-clause
- [ ] A `/credits` route shows the same notice and is reachable from the app
- [ ] Cburnett's name appears nowhere that reads as an endorsement of the app
- [ ] File and rank coordinates always visible, in both orientations
- [ ] Flipping to Black's perspective reverses the board and the coordinates together
- [ ] Both themes render, selectable by prop, green as the default
- [ ] The board stays square at every viewport width and never shrinks to make room for anything beside it
- [ ] Tapping a square emits it; the component holds no chess knowledge of its own
- [ ] `environment: "jsdom"` added to the Vitest config so DOM tests can run
- [ ] A rendering test asserts a known Position puts the right pieces on the right squares
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
