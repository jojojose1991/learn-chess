# Turning an image of a board into a Position

The decision this fed is [ADR-0002](../adr/0002-scan-pipeline.md).

## The landscape

### Vision LLMs are not accurate enough to be the input path

**MET-Bench** ([arXiv 2502.10886](https://arxiv.org/pdf/2502.10886), v3
2026-06-12) measures chess board-state tracking per square. Claude 3.7 Sonnet:
**96.1% ±0.2 from text, 70.2% ±0.5 from images.** The paper's conclusion is that
text beats image across every model tested.

At 70% per square, the chance of a fully correct 64-square board is
`0.7^64 ≈ 0`. No published figures exist for claude-opus-5 or claude-sonnet-5 on
this task — that is unmeasured, not quietly better.

Two papers that look relevant and are not: **ChessQA**
([arXiv 2510.23948](https://arxiv.org/pdf/2510.23948)) is text-only with no
vision evaluation — do not cite it for image work. **SEAM**
([arXiv 2508.18179](https://arxiv.org/html/2508.18179v1)) uses chess as a
modality-equivalence domain but reports no image→FEN transcription metric.

### Photographs of physical boards are a genuinely unsolved problem

Measured on **ChessReD** (10,800 real smartphone photos,
[dataset](https://data.4tu.nl/datasets/99b5c721-280b-450b-b058-b2900b69a90f)):

| System                                                                                                                                      | Whole-board accuracy                 |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| End-to-End Chess Recognition, ResNeXt-101 32×8d, 88.8M params ([arXiv 2310.04086](https://arxiv.org/html/2310.04086v1), VISAPP 2024) — SOTA | **15.26%** (3.40 mean wrong squares) |
| chesscog pipeline ([arXiv 2104.14963](https://arxiv.org/pdf/2104.14963))                                                                    | **2.30%** (42.87 mean wrong squares) |

chesscog scores 93.86% on its own synthetic Blender set — a **40× in/out-of-domain
gap**. CVChess ([arXiv 2511.11522](https://arxiv.org/pdf/2511.11522), Nov 2025)
reports 98.93% square-level in-domain but **65.17% per-square and 29.8%
full-board out-of-domain**. The 99%+ numbers in vendor blog posts are in-domain
on one specific chess set.

None of these ship as an npm package or a browser model.

### Hosted APIs and other packages

- **chessvision.ai** — consumer product only (extension, mobile app, eBook
  reader). No documented public developer API or pricing. An undocumented
  `app.chessvision.ai/predict` endpoint appears in third-party code; unsupported.
- **Roboflow Universe** — hosted inference on community chess-piece detection
  models. Returns bounding boxes, not a FEN; board homography and square
  assignment are yours. Datasets are 289–964 images, single chess set.
- **Lichess** has no board-scanner API.
- TF.js demos exist but are not packages: `Elucidation/ChessboardFenTensorflowJs`
  (MIT, needs a well-aligned board filling the frame),
  `truekendor/chessboard-image-to-fen` (YOLOv8n + MobileNetV3, 16 stars, no
  licence or accuracy stated).

## `@scoriiu/fenshot` internals

**v0.1.4, MIT, published 2026-07-19.** The only maintained npm package that does
image→FEN end to end in a browser. Extracted from coachess.app production code.
Repo: [github.com/scoriiu/fenshot](https://github.com/scoriiu/fenshot).

Its two halves have opposite value for us, which is the whole reason ADR-0002
exists.

### The detector — do not use it on photographs

`BoardCorners` is **four scalars, not four points**:

```ts
// packages/fenshot/src/detect.ts:26
export interface BoardCorners {
  x0: number
  y0: number
  x1: number
  y1: number
}
```

`extractBoardImage` (`tiles.ts:26`) is a bilinear **crop and independent x/y
resize** with no projective term. There is **no homography anywhere in the
pipeline**, and no per-tile grid-line following — tiles are assumed to be exactly
1/8 of the box, so keystone means every tile drifts progressively toward one edge.

How it finds the board: `gradientRows`/`gradientCols` (central differences) →
`houghResponse` where `hough[i] = sum(positive part) * sum(negative part)` along
the axis — i.e. **each entire row and column collapses to one scalar** →
`nonmaxSuppress` → keep peaks ≥ 0.2 of max → `getAllSequences` finds
arithmetic sequences of length ≥ 7 with `ERR_PX = 5` tolerance →
`checkerboardScore` arbitrates among candidates.

Two consequences:

- **Rotation tolerance is sub-degree.** A grid line must land within 5 px of
  prediction, and a rotated line smears its peak across `width · sin θ` rows. On
  a 1000 px board, ~0.3° already spreads the peak over 5 px. There is no deskew
  and no rotation search; `snapCorners` only translates (±tile/3, whole pixels).
  The README says so outright: _"The board must be roughly axis-aligned
  (screenshots are; photos of physical boards at an angle are not this tool)."_
- **Body text is a competing signal.** Because rows and columns are summed
  globally, evenly spaced text lines produce exactly the periodic peaks
  `getAllSequences` hunts for. Nothing localises the search to a region first.

It does **not** require the board to fill the frame — that was deliberately
fixed. The reference implementation's noise pre-gate was removed because it is
scale-dependent and rejected boards occupying part of a wider page. Fixtures
`reddit-page-board.png` and `whole-screen-two-boards.png` cover that case, and
`MAX_SCAN_PASSES = 3` masks an implausible or kingless hit and retries.

### The classifier — this is the valuable half

Input `tiles` float32 `[64, 1024]` (32×32 grayscale, 0..1), output
`probs [64, 13]`, classes `"1KQRBNPkqrbnp"` (index 0 = empty). Architecture:
3× (conv3×3 → BN → ReLU → maxpool2) at 32/64/64 channels, FC 1024→256, dropout
0.2, FC→13, softmax baked into the ONNX. **~330k params, 1.3 MB.**

**Print and book diagram styles are in the training corpus on purpose.** The
corpus is fully synthetic: ~72 piece sets × ~55 board textures from lichess'
`lila` repo and the chess.com CDN, positions 50% `chess.js` playouts / 50%
uniform random for class balance. Plus a `--procedural` pass adding flat
two-colour boards in random colour pairs (generalising to any site's flat theme)
**and hatched book-diagram boards**:

```ts
// generate-corpus.ts:71 — "Book/print diagram board: white squares, diagonally hatched dark squares."
const PRINT_SETS = [
  "lichess-alpha",
  "lichess-cburnett",
  "lichess-merida",
  "lichess-leipzig",
  "lichess-chess7",
  "lichess-companion",
  "lichess-fantasy",
]
```

Merida, Leipzig, Alpha and Chess7 are the diagram fonts used by Chess Informant,
ChessBase and most Western chess publishers; hatched dark squares are the
newspaper convention. `hatch` fires on 25% of procedural boards and 70% of those
force a print set. chess.com's `newspaper`, `book` and `letter` sets are also
present.

So **book and newspaper piece art is in-distribution.** What is out of
distribution is a _photograph_ of it: perspective, paper grain, show-through,
shadow gradient, glare, and halftone at odd sampling ratios. The corpus applies
JPEG q35–95, blur σ 0.3–0.8, resize round-trips and corner jitter of only ±3 px —
no halftone, no paper grain, no warp.

**No lighting normalisation at inference.** `imageToGray` downscales to
`MAX_DETECT_DIM = 1600`, converts with ITU-R 601 luma, and divides by 255. No
histogram equalisation, no CLAHE, no adaptive thresholding. The only illumination
robustness is baked into training and it is **global, not spatial** — a uniformly
dim tile is in-distribution; a shadow gradient across one tile, or specular
glare, is not.

### It fails loudly, which is the feature

`CONFIDENCE_FLOOR = 0.7` applies to the **worst** tile, plus a `plausible` gate
(exactly one king per side). Expect `reliable: false` on photographs rather than
silent garbage.

### Exports, and the missing entry point

Exported: `createRecognizer`, `recognizeGray`, `CONFIDENCE_FLOOR`,
`findChessboardCorners`, `snapCorners`, `extractBoardImage`, `boardToTiles`,
`extractTiles`, `rgbaToGray`, `probsToPlacement`, `flipPlacement`,
`resolveOrientation`, `inferCastling`, `placementToFen`. The model is
subpath-exported at `@scoriiu/fenshot/model/chess-tiles-v2.onnx`.

**There is no "recognize with these corners" entry point.** `recognizeGray` lets
you inject a classifier but still calls `findChessboardCorners` itself
(`recognize.ts:109`), and `createRecognizer` keeps its ORT session private. The
bypass is therefore:

1. Warp to a square N×N grayscale yourself → `{ data: Float32Array /* 0-255 */, width: N, height: N }`
2. `extractTiles(gray, { x0: 0, y0: 0, x1: N, y1: N })` → `Float32Array [64,1024]`
3. Your own `onnxruntime` session on the shipped model
4. `probsToPlacement(probs)` → `resolveOrientation` / `placementToFen` / `inferCastling`

About 15 lines, all public exports. Worth also running `snapCorners` on the
rectified image for the quarter-tile alignment fix, and copying `scanOnce`'s
two-candidate arbitration (classify raw and snapped, keep the higher
`meanConfidence`) — another ~20 lines.

### Open issues and gotchas

Three open issues, none about photographs: #1 infer side to move from last-move
highlights (**unimplemented** — so side to move must come from a person), #2
detect multiple boards in one image, #3 scan algebraic notation from book PDFs.

**Its `dist/` does not load in plain Node ESM.** Relative imports are
extensionless (`from "./recognize"`), which bundlers resolve and Node does not —
`import "@scoriiu/fenshot"` throws `ERR_MODULE_NOT_FOUND`.

**It surfaces under Vite too, which an earlier note here denied.** Vite
externalises `node_modules` on the SSR side, so it is Node that loads the
package in a Vitest run and in the server build alike, and the first import
throws. The fix is one line in `vite.config.ts` and not a `sed` over the
installed package:

```ts
ssr: {
  noExternal: ["@scoriiu/fenshot"]
}
```

The `onnxruntime-web` peer dependency is irrelevant on the low-level path —
`recognizeGray` takes an injected classifier, so `onnxruntime-node` works
directly against the shipped model. pnpm installs it anyway, because
auto-installed peers are the default: 136 MB of wasm on disk that nothing
imports and no bundle carries.

## Measured experiment, 2026-09-02

Four real images supplied by the user: (1) clean tan screenshot displayed from
**Black's** perspective with green last-move highlights, (2) clean light-grey
screenshot with "Mate in 1 move." captioned above and surrounding page chrome,
(3) **handheld phone photo of a laptop screen** showing a lichess study —
keystone, a few degrees of roll, glare and moiré, browser tabs and keyboard in
frame, (4) clean orange/grey screenshot with flat modern piece art.

Ground truth was read independently and agreed on all 256 squares.

### Full pipeline (detector + CNN)

|               | Detector box         | Correct?  | Placement | After `resolveOrientation` | `reliable` | mean  | min       |
| ------------- | -------------------- | --------- | --------- | -------------------------- | ---------- | ----- | --------- |
| 1 (1080×1095) | `0,12 → 1079,1091`   | **exact** | 38/64     | **64/64**                  | true       | 0.957 | 0.916     |
| 2 (1080×1131) | `64,137 → 1008,1082` | **exact** | **64/64** | 54/64 ❌                   | true       | 0.952 | 0.930     |
| 3 (899×1599)  | `372,92 → 784,504`   | **no**    | 37/64     | 37/64                      | **false**  | 0.893 | **0.375** |
| 4 (1000×1050) | `96,33 → 959,896`    | **exact** | **64/64** | **64/64**                  | true       | 0.952 | 0.896     |

Image 3's box is nowhere near the board — the board occupies x 7.4–93.6%,
y 13.3–59.1% of the frame; the detector returned x 41.4–87.2%, y 5.8–31.5%, a
region straddling the browser tab strip and the top third of the board. It read
a near-empty position and scored 37/64 by luck of empty squares. But
`reliable: false` with min confidence 0.375 — **no silent wrong answer.**

### Bypass path (manual corners → homography → warp → `extractTiles` → ORT)

|                     | Quad                       | Accuracy  | mean  | min       | `reliable` |
| ------------------- | -------------------------- | --------- | ----- | --------- | ---------- |
| 1                   | exact, axis-aligned        | **64/64** | 0.956 | 0.898     | true       |
| **3 (phone photo)** | keystoned, 4 manual points | **64/64** | 0.959 | **0.920** | **true**   |
| 4                   | exact, axis-aligned        | **64/64** | 0.951 | 0.915     | true       |

Image 3's quad is genuinely keystoned — `(66.7,212.7) (841.7,218.3) (778.3,945)
(112.7,927.7)`, top edge 775 px against bottom edge 666 px, a ~14% taper plus
roll. **The same CNN goes from 37/64 to 64/64 at higher minimum confidence than
any clean screenshot.** The classifier was never the problem; only the detector
was.

### The warp is doing the work, not the crop

Ablations on image 3:

| Approach                                                  | Accuracy  | min conf                  |
| --------------------------------------------------------- | --------- | ------------------------- |
| Exact bounding box of the quad, no perspective correction | **49/64** | 0.159                     |
| Rough manual crop, then let the detector re-run           | **56/64** | 0.226 (`reliable: false`) |
| Full four-point perspective warp                          | **64/64** | 0.920                     |

"Let the user crop and retry" is not a fix.

### Corner-drag tolerance

Image 3, 8 random jitters per level; one tile ≈ 90 px in the source photo:

| Jitter  | % of a tile | Accuracy | Perfect runs | min conf |
| ------- | ----------- | -------- | ------------ | -------- |
| ±0–6 px | ≤7%         | 64/64    | 8/8          | 0.79     |
| ±10 px  | 11%         | 64/64    | 8/8          | 0.35     |
| ±15 px  | 17%         | 58–64    | 3/8          | 0.16     |
| ±20 px  | 22%         | 56–64    | 2/8          | 0.26     |
| ±30 px  | 33%         | 45–61    | 0/8          | 0.13     |
| ±45 px  | 50%         | 41–51    | 0/8          | 0.18     |

**Roughly ±10% of a tile of slop before accuracy breaks** — so the handles need
a zoom loupe. Usefully, min confidence collapses (0.92 → 0.35) _before_ accuracy
does, making it a conservative early warning for misplaced corners.

Warp resolution is a non-issue: N = 256/512/1024 all give 64/64; only N=128 drops
to 63/64. Warp to 256 and stop.

### The `resolveOrientation` trap

It is what correctly flips image 1 (Black's perspective) from 38/64 to 64/64. It
is also what took image 2's **already-perfect** read and rotated it 180°, down to
54/64.

Root cause is the pawn-direction heuristic, not the CNN. Image 2's white pawns
sit on e7 and f6 (mean rank 6.5) and the only black pawn on h5 (rank 5) — white's
pawns are _further advanced_, so the heuristic concludes the board is flipped.
Confirmed directly: `resolveOrientation("4k3/4P3/4KP2/7p/8/8/8/8")` returns
`orientation: "black"`.

**Composed mate-in-N puzzles routinely have deeply advanced white pawns**, which
is precisely this app's content type. Ship it as a suggestion behind a visible
flip toggle, or skip it entirely when either side has fewer than ~3 pawns.

### Timing (onnxruntime-node, Apple Silicon, local model file)

|                                             |              |
| ------------------------------------------- | ------------ |
| Model load, cold `InferenceSession.create`  | **65–83 ms** |
| Warm warp + 64-tile inference (bypass path) | **4.4 ms**   |
| Full pipeline, warm, 899×1599               | **129 ms**   |

The detector dominates; the CNN is ~4 ms for all 64 tiles. Expect 2–5× slower
under wasm in a browser. Warm the session on boot and nobody waits.

### Browser 4-corner warp, if it ever moves client-side

A homography from four point pairs is an 8×8 linear solve.
`perspective-transform` (npm 1.1.3, ~2 KB, no deps) does exactly that —
last published 2022, which is finished rather than abandoned; the maths does not
rot. Or ~40 lines of DLT. Then inverse-warp over the destination: 65k bilinear
samples for 256×256 is under 5 ms in plain JS, no WebGL needed, and you can emit
the grayscale buffer in the same loop. Handles are four absolutely-positioned
divs with `touch-action: none`.

Avoid `jscanify` (1.4.3) unless you also want automatic corner detection — it
wraps **OpenCV.js at ~8 MB**, six times the entire model.

## The four corners, measured 2026-09-05

Ticket 15's own fixture: the same board, drawn through a CSS
`perspective(1000px) rotateY(-17deg) rotateX(7deg)` and screenshotted as a
JPEG at q80 — `pnpm tsx scripts/scan-fixture.ts` makes it and writes the four
projected corners beside it as `board-keystone.json`, measured by the browser
that drew them. Its top edge is 597 px against a bottom edge of 640 px and its
left side 581 px against a right side of 702 px, so a tile is about 77 px.

**It is not a photograph** — only real projective distortion and real lossy
compression. What it stands in for is keystone; what it cannot is a camera.

Every jitter below moves each corner on **both** axes, so ±8 px is 11 px of
displacement — about a seventh of a tile — and ±25 px is 35 px, near half.

| Four corners                   | Accuracy       | `reliable` | min       | mean  | ms  |
| ------------------------------ | -------------- | ---------- | --------- | ----- | --- |
| exact, from the browser        | **64/64**      | true       | **0.915** | 0.955 | 79  |
| ±8 px on each axis             | **64/64**      | **false**  | 0.375     | 0.903 | 32  |
| ±25 px on each axis            | 41/64          | false      | 0.239     | 0.808 | 29  |
| none — the detector left to it | no board found | —          | —         | —     | 34  |

Four things this settles, and the first two reproduce the 2026-09-02 numbers
on an image that had never been seen before.

- **On this image the detector returns `null`**, so the automatic path is not
  a bad read, it is no read at all.
- **The screen must show an unreliable corner read as a draft plus a
  warning**, never as a refusal. At a seventh of a tile of slop the read is
  still perfect and `reliable` is already false, so refusing one would throw
  away correct Positions.
- **An empty read is the one wrong answer the confidence floor cannot
  catch.** Four corners round a blank patch warp to one flat colour, which
  classifies as sixty-four empty squares at 0.95 and `reliable: true`. The
  detector's own path already refuses an all-empty read by masking and
  rescanning; the corner path has to refuse it too, or a collapsed quad — a
  client measuring handles in display pixels rather than the picture's own —
  answers 200 with an empty board on it.
- **Mean confidence is useless as a warning.** It moved 0.955 → 0.903 across
  the same jitter that took the minimum down by more than half.

## Not done

- **The test scripts lived in a session scratchpad and are gone.** The numbers
  above are the record. Re-deriving needs `@scoriiu/fenshot` + `onnxruntime-node`
  - `sharp`, the extensionless-import fix, and manual corner picking.
- **The four sample images are not in the repo**, and are still the only
  photographed board we have ever measured. Ticket 14 built its own fixtures
  instead — `pnpm tsx scripts/scan-fixture.ts` screenshots the app's own
  Cburnett art on its own green theme through chromium, giving a clean
  screenshot, the same board from Black's side, and one three degrees off
  square. They reproduce the numbers above (64/64 at 0.918 minimum confidence
  white-perspective; the Black-perspective read comes back mirrored with
  `resolveOrientation` saying "black"), and they are a script rather than
  three PNGs someone once had. What they cannot stand in for is a photograph,
  which is what ticket 15 needs — and 15 did not get one either. Its keystone
  fixture above is a rendering, so glare, paper grain and halftone remain
  unmeasured on every path.

## Measured again, 2026-09-05, on the fixtures above

Reproduced with `pngjs` decoding into `rgbaToGray` → `recognizeGray` → an
`onnxruntime-node` session on the shipped model.

|                                | Accuracy                | `reliable` | min   | ms  |
| ------------------------------ | ----------------------- | ---------- | ----- | --- |
| Clean screenshot, White's side | **64/64**               | true       | 0.918 | 32  |
| Same board from Black's side   | **64/64** mirrored      | true       | 0.931 | 21  |
| Same board as JPEG q80         | **64/64**               | true       | 0.941 | 23  |
| The same screenshot at 11 MP   | **64/64**               | true       | 0.904 | 221 |
| Board rotated 3°               | garbage                 | **false**  | 0.420 | 20  |
| A page of text, no board       | garbage                 | **false**  | 0.185 | 110 |
| A blank image                  | `null` — no board found | —          | —     | —   |

Two things this settles. A page of text does **not** return `null`; it returns
a placement with `reliable: false`, so "no board in the image" and "a board
read badly" are the same answer to a caller and want the same sentence. And
`MAX_DETECT_DIM` is the library's browser path, not `recognizeGray`'s — an
11 MP image is read at full size in 221 ms, so the cap on a Scan is memory
(about 8 bytes a pixel) rather than time.
