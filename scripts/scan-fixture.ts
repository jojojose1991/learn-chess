/**
 * The Scan fixtures: a real screenshot of a real board, taken by a real
 * browser. `docs/learnings/board-recognition.md` records that the four user
 * images the pipeline was measured on were lost with the session that made
 * them, which is why this is a script and not three PNGs someone once had.
 *
 *   pnpm tsx scripts/scan-fixture.ts
 *
 * It draws the board out of the app's own Cburnett art (ADR-0004) on the app's
 * own green theme, with page chrome around it, and screenshots it — so a
 * fixture is a screenshot of a board on a page, which is what a Coach uploads.
 */

import { readFileSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"

/** A Ruy-Lopez-ish opening: every piece kind, eight pawns a side. */
const POSITION = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR"

const OUT = new URL("../tests/fixtures/", import.meta.url)

/** The size of every fixture, and so the pixels its corners are measured in. */
const VIEWPORT = { width: 800, height: 860 }

const FIXTURES = [
  { file: "board-white.png", flip: false, transform: "none" },
  { file: "board-black.png", flip: true, transform: "none" },
  // The same board as a JPEG, which is what a screenshot becomes once it has
  // been through a messaging app on the way to the Coach.
  { file: "board-white.jpg", flip: false, transform: "none" },
  // Three degrees off square. The detector follows whole rows and columns, so
  // its rotation tolerance is under a degree — this is the clean-screenshot
  // pipeline failing, without a photograph to fail it with.
  { file: "board-askew.png", flip: false, transform: "rotate(3deg)" },
  // Keystone: as close to a phone photograph of a screen as a browser gets,
  // and how close that is, is measured in docs/learnings/board-recognition.md.
  // `corners` writes the four it landed on beside it.
  {
    file: "board-keystone.jpg",
    flip: false,
    transform: "perspective(1000px) rotateY(-17deg) rotateX(7deg)",
    corners: true,
  },
]

/** One square of the drawn board, top-left first in whichever order it is drawn. */
type Cell = { piece: string; light: boolean }

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: VIEWPORT })

  for (const { file, flip, transform, corners: marked } of FIXTURES) {
    await page.setContent(document(POSITION, flip, transform, marked))
    const path = new URL(file, OUT)
    const jpeg = file.endsWith(".jpg")
    await writeFile(
      path,
      await page.screenshot(jpeg ? { type: "jpeg", quality: 80 } : {})
    )
    process.stdout.write(`${path.pathname}\n`)

    if (marked) {
      // Measured, rather than worked out from the transform a second time.
      const corners = await page.$$eval(".corner", (marks) =>
        marks.map((mark) => {
          const box = mark.getBoundingClientRect()
          return { x: box.left, y: box.top }
        })
      )
      const beside = new URL(file.replace(/\.\w+$/, ".json"), OUT)
      await writeFile(
        beside,
        `${JSON.stringify({ ...VIEWPORT, corners }, null, 2)}\n`
      )
      process.stdout.write(`${beside.pathname}\n`)
    }
  }

  await browser.close()
}

/**
 * Zero-size marks at the board's four corners, clockwise from the top left.
 * They ride the same transform the board does, so each one's rect is where
 * that corner of the board ended up on screen.
 */
const CORNERS = [
  "left:0;top:0",
  "left:100%;top:0",
  "left:100%;top:100%",
  "left:0;top:100%",
]
  .map((at) => `<span class="corner" style="position:absolute;${at}"></span>`)
  .join("")

/** The page a screenshot is taken of: a board, and something around it. */
function document(
  placement: string,
  flip: boolean,
  transform: string,
  marked = false
) {
  const board = cells(placement)
  const cellsHtml = (flip ? [...board].reverse() : board)
    .map(({ piece, light }) => {
      const art = piece
        ? `<img src="${asset(piece)}" width="80" height="80">`
        : ""
      return `<div style="background:${light ? "#edeed1" : "#779952"}">${art}</div>`
    })
    .join("")

  return `<!doctype html><html><body style="margin:0;background:#f7f6f3;
    font:16px system-ui;display:flex;flex-direction:column;align-items:center;
    gap:24px;padding:40px">
    <p style="margin:0">White to play and win.</p>
    <div style="position:relative;display:grid;grid-template-columns:repeat(8,80px);
      grid-template-rows:repeat(8,80px);transform:${transform}"
      >${cellsHtml}${marked ? CORNERS : ""}</div>
  </body></html>`
}

/** A placement field as 64 squares, a8 first — the order a board is drawn in. */
function cells(placement: string): Array<Cell> {
  const pieces = placement
    .split("/")
    .flatMap((rank) =>
      [...rank].flatMap((token) =>
        /\d/.test(token)
          ? Array<string>(Number(token)).fill("")
          : [
              `${token === token.toUpperCase() ? "w" : "b"}${token.toUpperCase()}`,
            ]
      )
    )

  return pieces.map((piece, index) => {
    const file = index % 8
    const rank = 8 - Math.floor(index / 8)
    // a1 is dark, so a light square is one whose file and rank agree in parity.
    return { piece, light: (file + rank) % 2 === 0 }
  })
}

/** The vendored piece art, as a data URI: `setContent` has no origin to fetch from. */
function asset(piece: string) {
  const svg = readFileSync(
    new URL(`../public/pieces/${piece}.svg`, import.meta.url)
  )
  return `data:image/svg+xml;base64,${svg.toString("base64")}`
}

await main()
