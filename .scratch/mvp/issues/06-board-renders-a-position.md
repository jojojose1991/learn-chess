# 06 — The board renders a Position

**What to build:** The board, as the hero of every screen it appears on. Given
a Position it draws where every piece stands, in either theme, with coordinates
always shown. It renders a Position and emits taps, and it knows nothing about
Goals, engines or games — which is what makes it usable unchanged on all six
screens including the editor.

Themes are green `#779952` / `#edeed1` (default) and brown `#b58863` /
`#f0d9b5`. The highlight colour is reserved, so nothing saturated appears yet.

Rendered against hardcoded Positions; no data layer involved.

**Blocked by:** 01 — chess rules core.

**Status:** ready-for-agent

- [ ] A 64-square grid with classic Staunton SVG pieces, driven by a Position passed in
- [ ] File and rank coordinates always visible, in both orientations
- [ ] Flipping to Black's perspective reverses the board and the coordinates together
- [ ] Both themes render, selectable by prop, green as the default
- [ ] The board stays square at every viewport width and never shrinks to make room for anything beside it
- [ ] Tapping a square emits it; the component holds no chess knowledge of its own
- [ ] `environment: "jsdom"` added to the Vitest config so DOM tests can run
- [ ] A rendering test asserts a known Position puts the right pieces on the right squares
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
