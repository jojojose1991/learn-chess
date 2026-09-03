# What the two reference products actually set

Read from the shipped CSS on 2026-09-03, not from a style guide or a blog post
about either site.

## chess.com

`bundles/app/vite/*-global-styles.css` defines three families and no more:

```css
--font-family-heading: "Chess Sans", sans-serif
--font-family-system:  -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui,
                       Helvetica, Arial, sans-serif
--font-family-icons:   "Chess V3"
```

`Chess Sans` is proprietary and **ships in exactly two weights**:

```css
@font-face{font-family:Chess Sans; font-weight:700; src:url(ChessSans-Bold.woff2)}
@font-face{font-family:Chess Sans; font-weight:800; src:url(ChessSans-ExtraBold.woff2)}
```

There is no regular, no light, and no italic. Body text is the plain system
stack, so the only webfont on the page is a heading face that cannot be set
below 700. Icons are a font too, not SVG.

## lichess

Default body face is Noto Sans, with its own `lichess` glyph font for icons.
Also sans throughout, also unremarkable at body size.

## Why this matters

Both products get their voice from **weight and width**, and neither uses a
serif anywhere. A display serif was tried here first and rejected on sight as
"too thin and congested" — correctly: Instrument Serif is high-contrast,
tightly spaced, and ships weight 400 only, so it was being asked to carry
headings at the one thing it cannot do. The lesson is in chess.com's font-face
block: a heading face for this kind of product starts at 700.

Headings here are therefore Montserrat at 700 with tight tracking —
geometric, large x-height, wide apertures — over Geist for body.
`@fontsource-variable/montserrat/wght.css` carries the whole 100–900 axis in
one file per subset, and `unicode-range` means a latin reader fetches only
`montserrat-latin-wght-normal.woff2` (38 KB).

**Two webfonts is one more than either reference ships.** chess.com pairs its
heading face with the system stack and pays for no body font at all. Dropping
Geist for `--font-family-system` would save ~30 KB and is the obvious move if
font weight ever shows up in a page-weight budget; it is not done now because
body type in a system stack renders differently on every platform, and that is
a taste decision nobody has asked for.
