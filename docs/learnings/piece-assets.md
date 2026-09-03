# Chess piece artwork and its licensing

Researched 2026-09-02, read from the licence files themselves. Needed because
Q31 of the design session settled on "classic Staunton SVG, free licence" without
checking what "free" actually means for these particular assets.

**The headline: the best-looking modern Staunton sets on lichess are all
non-commercial.** `staunty`, `maestro`, `fresca`, `cardinal`, `gioco`, `tatiana`,
`dubrovny`, `icpieces`, `california`, `caliente` — every one is **CC BY-NC-SA
4.0**. The app is free today but may be monetised later, so all of them are out.
Picking by eye from lichess' board settings would have walked directly into this.

## Recommendation

**Primary: Colin M.L. Burnett's 12 Wikimedia Commons SVGs, taken under BSD
3-Clause, vendored into the repo.**

Files are `Chess_<kqrbnp><l|d>t45.svg` from
[Template:SVG chess pieces](https://commons.wikimedia.org/wiki/Template:SVG_chess_pieces)
(`t` = transparent background). Rename to `wK.svg` … `bP.svg`.
`https://commons.wikimedia.org/wiki/Special:FilePath/<name>` fetches the
current file directly, with no per-file hash path to look up.

**One of the twelve looks like it came from somewhere else, and did not.**
`Chess_klt45.svg` (our `wK.svg`) is SVGO attribute form — no DOCTYPE,
`fill="none" stroke="#000"` — while the other eleven are raw
`style="fill:#ffffff; …"` exports. That is not lichess' GPL-elected copy: a
Commons editor ran the file through SVGOMG **on Commons** in September 2022,
and it is byte-identical to what `Special:FilePath` serves today. Verified
against the file's `imageinfo` history, which also shows edits by TomFryers
(2020) and Antonsusi (2010, 2012). Contributions to a Commons file carry that
file's stated licence, so Cburnett's `{{self|GFDL|migration=relicense|BSD|GPL}}`
election covers them and ADR-0004 stands.

**No `viewBox` on any of the twelve**, only `width="45" height="45"`. They
still scale correctly as an `<img>` sized by CSS, because both intrinsic
dimensions are present — checked in Chromium at 74px and 90px. Nothing needs
patching, and patching would forfeit "vendored unmodified".

This is *the* classic Staunton reference — the set a child already sees in
Wikipedia articles and in most chess books' diagram fonts. Heavy outlines and
solid fills hold up at 32–40 px, which matters for the target age. Legally it is
the cleanest option available: no share-alike, no copyleft, no non-commercial
clause, no npm dependency, no abandonment risk, and twelve individual files that
can go through SVGR into React components with no licence anxiety, because BSD-3
has no problem with inlining.

**Fallback: `chessnut`, Apache 2.0** — from
[LexLuengas/chessnut-pieces](https://github.com/LexLuengas/chessnut-pieces),
whose repo root is already exactly twelve correctly-named SVGs plus `LICENSE.txt`
and a one-line `COPYRIGHT.txt`. Permissive, commercial-safe, no share-alike. It
is the fallback rather than the primary only because its silhouettes are flatter
and thinner-stroked than Cburnett's, so slightly weaker at the smallest sizes for
a five-year-old. Apache §4(b) note: if the pieces get recoloured, the modified
files must carry a prominent notice saying so.

## Cburnett is multi-licensed, and electing BSD is the whole trick

The Commons originals were checked directly — the raw wikitext of all twelve
files is identical:

```
|author={{U|Cburnett}}
{{self|GFDL|migration=relicense|BSD|GPL}}
```

That renders as a **four-way choice** — GFDL 1.2+, CC BY-SA 3.0 Unported (from
`migration=relicense`), BSD 3-clause (Commons' `Template:BSD` defaults to
3-clause), GPLv2+ (`Template:GPL` redirects to `Template:GPLv2+`) — followed by
**"You may select the license of your choice."**

So the widely-repeated "Cburnett pieces are CC BY-SA" is only one of four
options, and it is the second-worst of them. **Elect BSD-3 and the share-alike
question disappears entirely.** Lichess elected GPLv2+, which is why `lila`
declares `cburnett` as GPL rather than CC — the same art, a different election.

**Recording which option was elected is the part everyone skips, and it is what
makes the choice defensible later.**

Two traps on the way to these files:

- **The `jurgenwesterhof` adaptation** (`File:Chess_Pieces_Sprite.svg`) is
  **`{{cc-by-sa-3.0}}` only** — no BSD, no GPL, no choice. The derivative is
  *more* encumbered than the original, and it is one sprite rather than twelve
  files. Go to the originals.
- **`cm-chessboard`'s `standard.svg`** carries the header *"License:
  Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)"* — so taking Cburnett via
  that package inherits the BY-SA election rather than the BSD one.

## Does CC BY-SA's ShareAlike reach the app? No — only modified art

Worth recording because it is the question people get wrong in both directions.
CC BY-SA 3.0 §4(a), from the legal code:

> "This Section 4(a) applies to the Work as incorporated in a Collection, but
> this does not require the Collection apart from the Work itself to be made
> subject to the terms of this License."

And §1's definitions:

> "**Adaptation** means a work based upon the Work … except that a work that
> constitutes a Collection will not be considered an Adaptation for the purpose
> of this License."
>
> "**Collection** means a collection of literary or artistic works … in which
> the Work is included **in its entirety in unmodified form** …"

CC's own FAQ agrees: *"All Creative Commons licenses … allow licensed material to
be included in collections … **You may choose a license for the collection**,
however this does not change the license applicable to the original material."*

**Where it does bite:** recolouring pieces, editing paths, merging them into a
custom sprite, or restyling to match a board theme is an **Adaptation** — the
modified SVGs must then ship under BY-SA. App code stays proprietary either way.
Also, §2(a)(5)(B) forbids imposing additional restrictions on the licensed files
themselves, so no blanket "all rights reserved" over the piece directory.

⚠️ CC BY-SA **4.0** has no equivalent single "a collection is not an Adaptation"
sentence; the same conclusion there rests on §1(a)'s definition of Adapted
Material plus the CC FAQ. Moot for us, since our path is BSD.

## GPL'd artwork is much less painful than GPL'd code

Relevant if we ever take `merida`, `mono`, or lichess' GPL election of
`cburnett`.

What it **does** oblige: the SVGs stay GPL and cannot be relicensed; notices are
retained and the licence text shipped alongside; and serving files to browsers
**is** distribution (GPLv3 §0: *"To 'convey' a work means any kind of propagation
that enables other parties to make or receive copies."*).

What it **does not** oblige — and this is the useful part:

- **The source obligation is already discharged.** GPLv3 §0: *"The 'source code'
  for a work means the preferred form of the work for making modifications to
  it."* An SVG served to a browser **is** that preferred form, so serving the
  `.svg` satisfies it completely. There is no corresponding-source gap the way
  there is with compiled code. (Minifying or base64-inlining weakens this — keep
  an unminified copy at a stable URL.)
- **App code does not become GPL.** GPLv2 §2: *"mere aggregation of another work
  not based on the Program with the Program … does not bring the other work under
  the scope of this License."* GPLv3 §5 says the same for aggregates, and the FSF
  FAQ (#MereAggregation) confirms it. `<img src="/pieces/wK.svg">` is textbook
  aggregation.

**The one real trap for this stack:** inlining GPL'd SVG markup into `.tsx`
components makes those source files *contain* GPL'd material, and the aggregation
argument gets much weaker for a file that is literally a mixture. If a GPL set is
ever used, **keep the twelve pieces as separate `.svg` files** in a segregated
`assets/pieces/` directory carrying its own `LICENSE`. This constraint does not
apply to the BSD election, which is another reason to prefer it.

**AGPL is worse — rule out `letter`, `pirouetti`, `pixel`.** AGPL §13 requires
offering Corresponding Source to all users interacting over a network with a
modified version. The trigger is modifying the covered work, and the covered work
is the artwork; the boundary of "your version" for a network-served app is an
argument not worth having over piece graphics.

## The usable sets in lichess `lila`

`lila`'s [COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md)
is the single authority — there are no per-directory licence files. It has a
`## Exceptions (free)` table and a separate `## Exceptions (non-free)` table.

| Set | Licence | Attribution | Share-alike | Commercial |
|---|---|---|---|---|
| `rhosgfx` | CC0 1.0 | **no** | no | yes |
| `chessnut` | Apache 2.0 | yes | no | **yes** |
| `fantasy`, `spatial`, `celtic` | MIT | yes | no | **yes** |
| `kiwen-suwi`, `Firi` | CC BY 4.0 | yes | no | yes |
| `shapes` | CC BY-SA 4.0 | yes | **yes** | yes |
| `cburnett`, `mono`, `merida` | GPLv2+ | notice | **yes** | yes |
| `mpchess` | GPLv3+ | notice | **yes** | yes |
| `letter`, `pirouetti`, `pixel` | AGPLv3+ | notice | **yes + §13** | yes |

`rhosgfx` is the only genuinely unencumbered entry — and it is pixel art, so it
fails the Staunton requirement. Nothing else in the directory is CC0 or
public-domain equivalent.

### Disqualified

- **Non-commercial (CC BY-NC-SA 4.0)** — `staunty`, `maestro`, `fresca`,
  `cardinal`, `gioco`, `tatiana`, `dubrovny`, `icpieces`, `california`,
  `caliente`, `horsey`, `anarcandy`, `disguised`, `cooke`, `monarchy`; `xkcd` is
  CC BY-NC-SA 2.5. `alpha` is *"free for personal non commercial use"*.
- **Bare "freeware", which is a distribution model and not a licence** —
  `chess7`, `companion`, `leipzig`. Confirmed at enpassant.dk, which describes
  Mérida, Leipzig and Good Companion as "Freeware". No written grant covering a
  hosted web app.
- **Empty licence column in the source file** — `reillycraig`, `riohacha`
  (literally `public/piece/riohacha | |`). Unlicensed, not permissive by omission.
- **Undocumented entirely** — `governor`. The directory exists in
  `public/piece/`, but `grep -i governor COPYING.md` returns zero hits in both
  `lila` and `lichobile`, and the SVGs carry no embedded metadata.
- **No-derivatives** — `shahi-ivory-brown`.

## npm packages: most of them get the artwork licence wrong

The code licence and the artwork licence are different things, and several
packages declare only the former.

| Package | Code licence | Artwork | Verdict |
|---|---|---|---|
| `@chessire/pieces` 1.0.3 | MIT | Ships `ORIGINAL-GRAPHICS-LICENSE` with Cburnett's copyright and verbatim BSD-3. README: *"They are used under the 3-clause BSD license in this package."* | **The only package that gets it right.** React components, no `.svg` files, unmaintained since 2022. |
| `react-chessboard` 5.12.1 | MIT | **None. Zero attribution anywhere**, yet the inline JSX is byte-for-byte Cburnett (`viewBox "0 0 45 45"`). | Using it inherits an **unmet** attribution obligation. Already rejected on other grounds. |
| `cm-chessboard` 8.14.0 | MIT | `standard.svg` is CC BY-SA 3.0; **`staunty.svg` is CC BY-NC-SA 4.0**. | Don't ship the staunty sprite. |
| `chessboard-element` 1.2.0 | MIT | **None.** 36 PNGs including the `alpha` set that `lila` files as non-free. | Real exposure. |
| `react-chess-pieces` 1.1.2 | "ISC", **no LICENSE file** | README: *"originally licensed under … CC BY-SA 3.0 …, which I think is okay to republish as ISC"* — sourced from the BY-SA-only sprite. | **Invalid relicensing.** The only package shipping 12 individual SVGs, and it cannot be used. |
| `@ultrachess/pieces` 1.1.1 | MIT | **Ships no art — hotlinks chess.com's CDN**, under an export named `cburnett`. | Third-party proprietary art mislabelled with an open-source artist's name. |
| `@lichess-org/chessground` 10.1.1, `@lichess-org/pgn-viewer` 2.6.4 | **GPL-3.0-or-later** | Cburnett base64'd into CSS. Chessground's README: *"your combined work may be distributed only under the GPL. **You must release your source code** to the users of your website."* | Rule out. |

## What to actually do

```
public/pieces/               # 12 .svg files, unmodified, served as-is
public/pieces/LICENSE        # full BSD-3 text
THIRD_PARTY_NOTICES.md       # repo root
/credits                     # app route, linked from the footer
```

Notice text for both `THIRD_PARTY_NOTICES.md` and the `/credits` page:

> **Chess piece graphics**
> Copyright (c) Colin M.L. Burnett (Wikimedia Commons user
> [Cburnett](https://en.wikipedia.org/wiki/User:Cburnett)).
> Used under the 3-clause BSD License. Full text: `/pieces/LICENSE`.
> Source: https://commons.wikimedia.org/wiki/Template:SVG_chess_pieces
> The graphics are multi-licensed by the author under GFDL 1.2+, CC BY-SA 3.0,
> BSD 3-clause and GPLv2+; they are used here under the BSD 3-clause license.

BSD §3 also means Cburnett's name must not be used to promote the app — crediting
him on a notices page is fine, putting "Chess pieces by Cburnett!" on the landing
page as an endorsement is not.

## Could not verify at source

- **`merida`'s GPLv2+ status.** Asserted by both `lila` and `lichobile`, but
  contradicted by the original author's own distribution page, which describes
  Mérida as "Freeware" — and `lila` itself files Leipzig, by the same author from
  the same page, under *non-free*. No GPL grant from Armando Hernandez Marroquin
  was located anywhere. **The one entry in `lila`'s free table not to bet on.**
- **`shapes`' CC BY-SA 4.0.** `flugsio/chess_shapes` has no LICENSE file (404)
  and the README makes no licence statement. `lila`'s claim is unconfirmed at the
  artwork's own source.
- **`governor`** — no licence statement in any repo, no embedded SVG metadata.
- **`kosal`** — CC BY 4.0 per `lichobile/COPYING.md` only; omitted from `lila`'s
  file despite the directory existing. No statement found on philatype.com.
- **`totoy` / `papercut`** — tagged CC BY 4.0 yet filed under
  `## Exceptions (non-free)`. `lila` contradicts itself; unresolved.
- **`samboy/ChessGraphics`** (Cuernavaca/Tepoztlan) offers Unlicense or BSD-0
  with *"No attribution is needed"*, but the grant rests on the author's own
  legal theory that *"Fonts, including chess diagram fonts, can not be
  copyrighted in the United States"*. A legal argument, not a chain of title.
- **`@echecs/react-board` 3.0.0** claims a bundled cburnett set but has no
  attribution and a `viewBox 0 0 300 300` rather than Cburnett's 45×45.
  Provenance unverified.
