# Chess rules, board UI, and engine strength

## Rules engine: `chess.js`

**1.4.0, BSD-2-Clause, published 2025-06-14, last commit 2026-08-11.** 4.4k
stars, actively developed. Written in TypeScript with types bundled
(`dist/types/chess.d.ts`), ships both `dist/cjs/` and `dist/esm/` via
`main`/`module`/`types`, **zero runtime dependencies**.

No `exports` map and no `"type": "module"` — fine for Vite/Turbopack, which
resolve `module` for ESM.

⚠️ **1.4.0 is over a year behind `master`**, so a few documented methods exist
only on the main branch. Check before relying on anything not listed here.

What we need is all present:

- `new Chess(fen?, { skipValidation })`, `load(fen, { skipValidation, preserveHeaders })`,
  `fen({ forceEnpassantSquare })`, and a standalone `validateFen(fen): { ok, error? }`.
- `moves()` is heavily overloaded — `{ verbose: true }` → `Move[]`, plus
  `{ square }` and `{ piece }` filters. `move(san | { from, to, promotion? }, { strict })`,
  `undo()`.
- Terminal states: `isCheck`, `inCheck`, `isCheckmate`, `isStalemate`,
  `isInsufficientMaterial`, `isThreefoldRepetition`, `isDrawByFiftyMoves`,
  `isDraw`, `isGameOver`.
- Castling and en passant round-trip through FEN, plus explicit
  `getCastlingRights(color)` / `setCastlingRights(color, rights)`.
- `Move` carries `isCapture` / `isPromotion` / `isEnPassant` /
  `isKingsideCastle` / `isQueensideCastle` / `isBigPawn`. The string `flags`
  field is **deprecated, removal in 2.0** — don't use it.
- Useful for teaching: `attackers(square, by?)`, `isAttacked()`, `board()`,
  `ascii()`, `squareColor()`, `findPiece()`, `hash()`, `history({ verbose })`,
  PGN load/emit.

`validateFen` does **not** check everything a playable Position needs, but it
checks more than we first thought. Measured against 1.4.0 while building
`src/lib/chess/rules.ts`:

| Invariant | `validateFen` 1.4.0 |
|---|---|
| exactly one king a side | **rejects** — `missing white king`, `too many black kings` |
| no pawn on rank 1 or 8 | **rejects** — `some pawns are on the edge rows` |
| at most 8 pawns a side | passes 9 pawns as `ok` — **ours to add** |
| side *not* to move is not in check | passes as `ok` — **ours to add** |

So only the last two are ours. `findPiece({ type: "p", color })` counts pawns,
and `isAttacked(king, turn)` answers the check question without having to flip
the side to move.

### Getting pseudo-legal moves out of a library that will not give them

`moves()` only ever returns *legal* moves, and 1.4.0 exposes no pseudo-legal
generator. Telling "that piece cannot reach that square" apart from "that would
expose your own king" needs one, because the only filter `moves()` applies on
top of pseudo-legality **is** king safety. Two probes, both measured while
building `explainIllegal`:

- **Take the moving side's king off the board.** `new Chess(fen, { skipValidation: true })`
  then `remove(kingSquare)`, and `moves()` returns pseudo-legal moves — the
  check filter has nothing left to filter on, and it does not throw on the
  missing king. Meaningless for a king's own move, which is the one case that
  needs the other probe.
- **Put the piece alone on a cleared board** — `clear()`, `put(piece, square)`,
  `setTurn(color)` — and `moves()` gives pure movement shape. Note what this
  loses: a lone pawn generates **no diagonal captures** (nothing to capture)
  and a lone king generates **no castling** (rights are cleared with the
  board), so a pinned pawn's capture must be recognised on the true board
  first, and a castle must be special-cased before this probe sees it.

`remove`, `put` and `setTurn` all exist in 1.4.0 despite not being listed above.

Two more measured behaviours:

- `fen()` **drops the en-passant square when no capture can actually be made**,
  so the position after `1. e4` serialises as `... b KQkq - 0 1`, not `e3 0 1`.
  `fen({ forceEnpassantSquare: true })` brings it back **only for a FEN that
  was loaded carrying it** — after a `move()` there is nothing left to force,
  because `move()` clears `_epSquare` outright when no enemy pawn is adjacent.
  Positions with castling rights, or with an en-passant square a pawn can
  really use, do round-trip byte for byte.
- `move({ from, to })` **throws** on a promoting move with no `promotion`
  field, rather than defaulting to a queen. Good: a silent queen would defeat
  the promotion picker.

### Alternative considered: `chessops`

**0.15.1, GPL-3.0-or-later, last commit 2026-09-01.** Lichess's engine —
immutable, functional, bitboard-based, has a real `exports` map, supports
variants, and is faster and arguably better designed.

Rejected on two counts: GPL-3.0 for a library linked into our own code, and a
much less obvious API. Revisit only if we need variants.

## Board UI: hand-rolled

### `react-chessboard` was considered and rejected

**5.12.1, MIT, published 2026-08-16.** `peerDependencies` are
`react: "^19.0.0"` / `react-dom: "^19.0.0"` — **React 19 only** (React 18 needs
v4). Depends on `@dnd-kit/core` and `@dnd-kit/modifiers`. `"type": "module"`
with a proper `exports` map. `dist/index.esm.js` is **184 KB raw**, plus dnd-kit.

SSR-safe: the bundle contains the isomorphic `useLayoutEffect : useEffect`
guard, so no hydration warning. But it has **no `"use client"` banner** — its own
roadmap says to add the directive to your consuming component.

v5 takes a single options object: `<Chessboard options={{ ... }} />`, with
`position` (FEN or `PositionDataType`), `boardOrientation`, `squareStyles`,
`allowDragging`, `canDragPiece`, `onPieceDrop` (return `boolean` to accept or
reject), `onSquareClick`, `onPieceClick`, `arrows` / `allowDrawingArrows`,
`animationDurationInMs`, `showAnimations`, `pieces` (custom SVG renderers),
`squareRenderer`, `chessboardRows`/`Columns`, `dragActivationDistance`,
`showNotation`.

**Why we skipped it:** the 184 KB is mostly pointer-based drag with touch
sensors and scroll suppression, FLIP move animations, arrow drawing and spare
pieces. This app is tap-then-tap with no animation, so almost none of that is
used. A static tap-to-move board is genuinely small: `chess.js`'s `board()` →
64 divs in `grid-template-columns: repeat(8, 1fr)` with `aspect-ratio: 1`,
`:nth-child` for colours, and `moves({ square, verbose: true })` driving a `Set`
of highlighted targets. **~70 lines plus 12 piece SVGs.**

If drag is ever wanted, take the library rather than reimplementing pointer
sensors.

### Others

- `cm-chessboard` **8.14.0** (2026-09-01) — vanilla ES modules, lightweight, no
  React wrapper.
- `@lichess-org/chessground` **10.1.1** (2026-03-27) — GPL-3.0, Snabbdom-based,
  awkward inside React.

## Engine strength: why a weak bot cannot be an engine setting

This is the finding that surprised us most, read out of Stockfish `master`.

```cpp
// src/engine.cpp
options.add("Skill Level", Option(20, 0, 20));            // default 20, range 0-20
options.add("UCI_LimitStrength", Option(false));
options.add("UCI_Elo", Option(Skill::LowestElo, Skill::LowestElo, Skill::HighestElo));

// src/search.h
constexpr static int LowestElo  = 1320;
constexpr static int HighestElo = 3190;
```

**`Skill Level` floors at 0 and `UCI_Elo` floors at 1320** — and at 1320 the
polynomial maps to internal level ≈ 0, i.e. identical to Skill Level 0. **1320 is
a hard floor; there is nothing weaker in vanilla Stockfish.** Skill works via
`time_to_pick(depth) == 1 + int(level)`, so level 0 picks from a depth-1 search
with a randomised bias toward slightly worse moves.

**1320 Elo is not beatable by a 5–10 year old beginner.** Community estimates of
"Stockfish level 0" range 850–1350 but all sit far above a first-year child.

Two ways lower, if a real engine is wanted:

1. **Fairy-Stockfish** permits negative skill —
   `o["Skill Level"] << Option(20, -20, 20)` and
   `o["UCI_Elo"] << Option(1350, 500, 2850)`. This is what Lichess does: from
   `lichess-org/fishnet/src/api.rs`, **AI level 1 = Skill Level −9, depth 5,
   50 ms**, mapping `1→−9, 2→−5, 3→−1, 4→3, 5→7, 6→11, 7→16, 8→20`.
   npm `fairy-stockfish-nnue.wasm` **1.1.12** (GPL-3.0) is only a **1.6 MB
   wasm** — 4× smaller than Stockfish lite — but it ships
   `stockfish.worker.js` and references `SharedArrayBuffer`/pthreads, so it is
   **multi-threaded only and COOP/COEP is mandatory.** No TS types.
2. Cripple vanilla yourself: `MultiPV 5` + `go depth 1`, pick randomly from the
   list, or drop moves that lose material.

**Conclusion for a beginner opponent: hand-roll it on `chess.js`.** Random legal
move is one line. "Greedy with a difficulty knob" is ~30 lines: score
`moves({ verbose: true })` by piece value captured minus whether the destination
`isAttacked()`, then pick the *n*-th best where *n* comes from a per-level
distribution. Everything needed (`moves`, `isAttacked`, `attackers`,
`isCheckmate`) is already in `chess.js`. Zero extra bytes, no COOP/COEP, no
GPL obligation, instant moves — and mistakes a six-year-old can actually learn
from. A depth-1 NNUE engine loses in ways a child cannot learn from.

This is why [ADR-0003](../adr/0003-server-side-compute.md) uses a full-strength
engine as the puzzle *defender* only, and why a weak sparring opponent is in
[BACKLOG.md](../BACKLOG.md) as separate work.

## Stockfish in the browser (rejected, kept for reference)

`stockfish` **18.0.8** (GPL-3.0, published 2026-06-15, by Nathan Rugg,
sponsored by Chess.com) is the current wasm package. Five flavours, sizes
measured from the tarball:

| Build | `.wasm` | Threads | Needs COOP/COEP |
|---|---|---|---|
| `stockfish-18.wasm` | 107.8 MB | multi | **yes** |
| `stockfish-18-single.wasm` | 107.8 MB | single | no |
| `stockfish-18-lite.wasm` | 6.8 MB | multi | **yes** |
| `stockfish-18-lite-single.wasm` | **7.0 MB** | single | **no** |
| `stockfish-18-asm.js` | 10 MB (JS) | single | no |

Its README recommends **lite single-threaded**: *"the lite engine is still far
stronger than any human will ever be, and the full engine is so large that it can
be very slow to load."* The npm tarball unpacks to ~239 MB, so the postinstall
matters.

Do **not** use: `stockfish.js` (10.0.2, last published **2019**),
`stockfish.wasm` (0.10.0, 2021), `stockfish-nnue.wasm` (2021),
`lila-stockfish-web` (0.0.11, AGPL-3.0, built for lichess internals).

**COOP/COEP** is only needed for multi-threaded builds (`SharedArrayBuffer`).
Feature-detect with `crossOriginIsolated`. If ever required:

```ts
// next.config / vite equivalent
headers: [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
]
```

Note that cross-origin isolation breaks every cross-origin subresource lacking
CORP — Google Fonts, analytics, embedded iframes. Going single-threaded sidesteps
all of it.
