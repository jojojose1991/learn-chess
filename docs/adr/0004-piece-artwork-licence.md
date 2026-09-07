# Piece artwork is Cburnett's, elected under BSD 3-Clause

The twelve piece SVGs are Colin M.L. Burnett's Wikimedia Commons set, vendored
into `public/pieces/` and used under the **BSD 3-Clause** licence. The Commons
originals are multi-licensed — the wikitext is
`{{self|GFDL|migration=relicense|BSD|GPL}}`, rendering as GFDL 1.2+, CC BY-SA
3.0 Unported, BSD 3-clause and GPLv2+, followed by *"You may select the license
of your choice."* We elect BSD, which removes share-alike and copyleft entirely.

## Considered options

**The other three elections of the same art.** GFDL 1.2+ is impractical for a
web app. CC BY-SA 3.0 carries share-alike on any recolouring or restyling of the
pieces. GPLv2+ is what lichess elected — which is why `lila` declares `cburnett`
as GPL — and while GPL'd artwork is mild (the SVG already *is* the preferred form
for modification, so serving it discharges the source obligation), it would
forbid inlining the markup into `.tsx` components without weakening the mere-
aggregation argument.

**The better-looking sets, all rejected as non-commercial.** `staunty`,
`maestro`, `fresca`, `cardinal`, `gioco`, `tatiana`, `dubrovny`, `icpieces`,
`california` and `caliente` are every one **CC BY-NC-SA 4.0**. The app is free
today with no monetisation planned, but choosing art that forecloses it is not a
trade worth making for nicer bishops.

**Taking it from a package.** `@chessire/pieces` is the only npm package that
documents the artwork licence correctly (it ships `ORIGINAL-GRAPHICS-LICENSE`
and elects BSD-3 explicitly), but it is unmaintained since 2022 and ships React
components rather than files. `react-chessboard` and `chessboard-element` ship
this art with **no attribution at all**; `react-chess-pieces` relicensed a
BY-SA-only derivative as ISC, which is invalid. Vendoring from Commons avoids
inheriting anyone else's licence mistake.

**Fallback if the shapes prove wrong for the age group:** `chessnut`, Apache 2.0,
already twelve correctly-named SVGs in its repo root.

## Consequences

Ship `public/pieces/LICENSE.txt` with the full BSD-3 text, and state the
election in `THIRD_PARTY_NOTICES.md` and a `/credits` route — *"multi-licensed
under GFDL 1.2+, CC BY-SA 3.0, BSD 3-clause and GPLv2+; used here under the BSD
3-clause license."* Recording **which** option was elected is what makes the
choice defensible later, and it is the step people skip.

**The `.txt` is load-bearing, and was not the original name.** srvx's static
handler cannot serve an extensionless file, so `public/pieces/LICENSE` 404'd on
the deployed service (`docs/learnings/deployment.md`). Ticket 06's review
declined this rename because a download is not a failure — true only while the
file was reachable, which on Cloud Run it was not. A licence pointer that 404s
is a BSD §2 problem, so the extension stays.

BSD §3 forbids using Burnett's name to promote the app. Crediting him on a
notices page is required; "Chess pieces by Cburnett!" on the landing page as an
endorsement is not.

Because BSD-3 permits inlining, the pieces may be run through SVGR into React
components. Had we elected GPL, they would have had to stay as separate `.svg`
files in a segregated directory.

Full research, including the per-set licence table and six unverified claims, is
in [docs/learnings/piece-assets.md](../learnings/piece-assets.md).
