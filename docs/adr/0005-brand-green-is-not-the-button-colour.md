# The brand green is neither the button nor the ring

The app's green is `#779952` — the green board's dark square, and the favicon.
It is neither `--primary` nor `--ring`. Buttons are a dark olive ink that reads
as near-black; so is the focus ring. Green ships in two places: the active
sidebar item as `--brand-ink`, and the wordmark's checker as `--brand`.

## Why

`docs/PLAN.md` already settled the rule this follows from:

> Low saturation, and the highlight colour is reserved for Guidance and
> last-move so the only saturated thing on screen always means something.

The Play screen puts Reset, Rewind, Hint and the Guidance toggle inches from a
board whose Guidance marks and last-move highlight are the only saturated
things a Student is meant to notice. A green Hint button beside green marked
squares spends the board's one signal on chrome. Dark ink never competes with
the board, in either theme, at any size.

The ring has a harder reason. The board renders 64 buttons whose focus
indicator is the author `outline-color`, so the ring is drawn *on* a square. A
green ring measures **1.00** against the green board's dark square and 1.03
against the brown board's — invisible, not merely weak. Ink measures 5.50 and
5.68 on those squares and 17.15 on the page. A focus ring has to be visible
everywhere it can land, and on this product that includes both boards.

## Consequences

**Two greens exist and both are tokens.** `--brand`
(`oklch(0.64 0.105 130)`, exactly `#779952`) is the fill. It arrived with the
first thing that fills with it, the wordmark's checker, and not before —
measuring 3.11:1 on the page and 2.96:1 on the sidebar, which a decorative
`aria-hidden` mark beside the words it illustrates is allowed to be.
`--brand-ink` (`oklch(0.47 0.095 132)`) is the same green pulled dark enough to
be text, which the fill is not: at 3.12:1 on the app background it is fine for
a fill and short of the 4.5:1 small text needs.

**`--brand-ink` and `--board-dark` are not the same thing** and neither should
be made to reference the other, though both descend from `#779952`. One is a
brand decision; the other is a board theme a Coach can change (ticket 20).

**Ticket 07 inherits a constraint, not a value.** Ticket 06 put both boards on
screen and left the reserved Guidance and last-move highlight to the screen
that needs it. That colour must not be green, and — by the same measurement
that moved the ring — it has to be legible on all four squares. The trick that
makes one value do that is a translucent overlay shifting the square rather
than replacing it. Naming a hex here, with nothing to look at, would be
guessing.

## What ticket 07 measured

`--board-mark` is `oklch(0.35 0.14 55)` — a dark burnt orange, on `:root` and
shared by both themes. As a **shape** at full alpha it measures 9.92, 3.61,
8.55 and 3.73 against light green, dark green, light brown and dark brown, so
the Guidance dot, the capture ring and the two borders clear 3:1 everywhere
they can land.

**The translucent overlay guessed at above does not work on its own.** A
whole-square wash of that colour measures 2.52, 1.90, 2.39 and 1.82 at 45%,
and still only 2.68 on dark green at 70% — by which point the square has lost
the colour the wash was meant to shift. So the shapes carry the contrast, the
wash is reinforcement, and every mark also says itself in the square's
accessible name (`", selected"`, `", can move here"`, `", last move"`). Dark
is the direction that works on all four fills, which is the same finding
ticket 06 made for the square coordinates.

**The board's focus outline is settled here too.** The base layer's
`outline-ring/50` measures 2.36:1 on the dark green square — the shortfall
ticket 06 left carried forward. Each square now sets `outline-ring` at full
alpha with a negative offset, which is the 5.50:1 and 15.11:1 this ADR already
records for ink.

## Considered and rejected

**Green as `--primary`, the chess.com reading.** Its CTAs are green and it
works there, because its board sits in a busy page where nothing else is
trying to be the only signal. This board is the hero of every screen it
appears on and its highlight budget is one colour.

**Chrome with no green at all, the lichess reading.** Nearly right, and this
palette copies its discipline — the chrome is never *coloured*, only ever
warm. One hue survives, on the active nav item, because this app is opened a
few times a week rather than navigated from memory daily.
