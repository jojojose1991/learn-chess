/**
 * The Scan eval: real photographs, scored square by square.
 *
 *   pnpm eval              # every image under eval/images
 *   pnpm eval book         # only that set
 *
 * Deliberately not part of `pnpm test` or CI. It needs the photographs, which
 * live in Git LFS and which CI never fetches, and it is a measurement rather
 * than a gate — a number to look at every few weeks, not a build to break.
 * `eval/README.md` says how to add an image and what the columns mean.
 *
 * It decodes through `src/lib/scan/decode.ts`, the server's own, so that a
 * file the upload would refuse is refused here too and scores nothing. What it
 * varies is the two ports in `./strategies`.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { basename, extname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  CONFIDENCE_FLOOR,
  extractTiles,
  probsToPlacement,
  rgbaToGray,
} from "@scoriiu/fenshot"
import * as ort from "onnxruntime-node"

import { decode } from "@/lib/scan/decode"
import { upright } from "@/lib/scan/orientation"

import { readers, siders } from "./strategies"

import type { GrayImage } from "@scoriiu/fenshot"

// `fileURLToPath`, not `.pathname`, which percent-encodes — a checkout under
// a directory with a space in it would ENOENT on its own images.
const IMAGES = fileURLToPath(new URL("images/", import.meta.url))
const RESULTS = fileURLToPath(new URL("results/", import.meta.url))

/**
 * What a person read off the page, which is not all of what a person can see.
 * `sideToMove` is the honest example: a book prints "White to play" in the
 * caption beside the diagram, not inside it, so a null here is a fact about
 * the photograph and not a gap in the labelling. Nothing scores against null.
 */
type Expected = {
  placement: string
  orientation: "white" | "black"
  sideToMove: "w" | "b" | null
  sideToMoveFrom: string
  notes?: string
}

/**
 * A photograph and what a person read off it. The pixels are a thunk so that
 * the set is decoded one at a time — a 12 MP frame is 48 MB of Float32
 * grayscale, and `field/` is meant to grow.
 */
type Case = {
  set: string
  name: string
  /** The image, or the reason the server would not open it. */
  read: () => GrayImage | string
  expected: Expected
}

/** What one reader did across the whole set. */
type Tally = { squares: number; boards: number; found: number }

async function main() {
  // `.at`, not `[2]`: `noUncheckedIndexedAccess` is off, so an index reads as
  // `string` and every guard against a missing set lints away as unnecessary.
  const only = process.argv.at(2)
  const cases = load(only)
  if (!cases.length) {
    console.log(`No images under ${join(IMAGES, only ?? "")}.`)
    console.log("Git LFS holds them: `git lfs pull`, or see eval/README.md.")
    return
  }

  const { classify, release } = await classifier()
  try {
    await score(cases, classify, only)
  } finally {
    // Always: `onnxruntime-node` aborts out of its own destructor at exit, so
    // a throw in here would otherwise surface as exit 134 rather than as
    // whatever actually failed.
    await release()
  }
}

async function score(
  cases: Array<Case>,
  classify: Awaited<ReturnType<typeof classifier>>["classify"],
  only?: string
) {
  const runs = readers(classify)
  const tallies = new Map<string, Tally>(
    runs.map((reader) => [reader.name, { squares: 0, boards: 0, found: 0 }])
  )

  const refused = new Set<string>()
  for (const one of cases) {
    const image = one.read()
    if (typeof image === "string") {
      // Scores zero against every reader and is left out of the sider's
      // denominator too, so the two tables count the same population: an
      // upload the server refuses is a pipeline failure, not a bad fixture.
      refused.add(`${one.set}/${one.name}`)
      console.log(`\n${one.set}/${one.name}  refused: ${image}`)
      continue
    }
    console.log(`\n${one.set}/${one.name}  ${image.width}×${image.height}`)
    const expected = asSquares(one.expected.placement)

    for (const reader of runs) {
      const began = Date.now()
      const read = await reader.read(image)
      const ms = Date.now() - began
      const tally = tallies.get(reader.name) as Tally
      if (!read) {
        console.log(
          `  ${reader.name.padEnd(7)} no board found${" ".repeat(45)}${String(ms).padStart(5)}ms`
        )
        continue
      }
      const right = asSquares(read.placement).filter(
        (piece, at) => piece === expected[at]
      ).length
      tally.squares += right
      tally.boards += right === 64 ? 1 : 0
      tally.found++
      console.log(
        `  ${reader.name.padEnd(7)} ${String(right).padStart(2)}/64 ` +
          `${read.minConfidence >= CONFIDENCE_FLOOR ? "reliable" : "        "} ` +
          `agree=${read.agreement} min=${read.minConfidence.toFixed(3)} ` +
          `${String(ms).padStart(5)}ms  ${read.placement}`
      )
    }
  }

  const scored = cases.filter((one) => !refused.has(`${one.set}/${one.name}`))
  console.log(
    `\n═══ ${scored.length} photographs, ${scored.length * 64} squares` +
      `${refused.size ? `, ${refused.size} refused by the decoder` : ""}\n`
  )
  console.log("  reader   squares  boards  found")
  for (const [name, tally] of tallies) {
    console.log(
      `  ${name.padEnd(8)} ${String(tally.squares).padStart(4)}/${scored.length * 64}` +
        `   ${String(tally.boards).padStart(2)}/${scored.length}` +
        `   ${String(tally.found).padStart(2)}/${scored.length}`
    )
  }

  // Scored against the placement a person read, not against a reader's, so
  // that a wrong orientation is the sider's fault and never the detector's.
  console.log("\n  sider    right  declined  wrong")
  const sides = new Map<
    string,
    { right: number; declined: number; wrong: number }
  >()
  for (const sider of siders) {
    const tally = { right: 0, declined: 0, wrong: 0 }
    for (const one of scored) {
      const answer = sider.seenFrom(one.expected.placement)
      if (answer === null) tally.declined++
      else if (answer === one.expected.orientation) tally.right++
      else tally.wrong++
    }
    sides.set(sider.name, tally)
    console.log(
      `  ${sider.name.padEnd(8)} ${String(tally.right).padStart(4)}` +
        `  ${String(tally.declined).padStart(8)}  ${String(tally.wrong).padStart(5)}`
    )
  }

  // The set is in the name, so `pnpm eval book` cannot overwrite the day's
  // whole-set record with a subset's numbers.
  const stamp = `${new Date().toISOString().slice(0, 10)}${only ? `-${only}` : ""}`
  mkdirSync(RESULTS, { recursive: true })
  writeFileSync(
    join(RESULTS, `${stamp}.json`),
    `${JSON.stringify(
      {
        ran: new Date().toISOString(),
        photographs: scored.map((one) => `${one.set}/${one.name}`),
        refused: [...refused],
        readers: Object.fromEntries(tallies),
        siders: Object.fromEntries(sides),
      },
      null,
      2
    )}\n`
  )
  console.log(`\n  written to eval/results/${stamp}.json`)
}

/**
 * Every photograph with an expectation beside it, in the named set or all of
 * them. HEIC is in the sweep on purpose: iPhones shoot it by default, the
 * server decodes PNG and JPEG only, and a set that skipped the files the
 * pipeline cannot open would report a health it does not have.
 */
function load(only?: string): Array<Case> {
  const sets = readdirSync(IMAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && (!only || entry.name === only))
    .map((entry) => entry.name)

  return sets.flatMap((set) =>
    readdirSync(join(IMAGES, set))
      .filter((file) => /\.(jpe?g|png|heic)$/i.test(file))
      .sort()
      .flatMap((file) => {
        const path = join(IMAGES, set, file)
        const sidecar = join(
          IMAGES,
          set,
          `${basename(file, extname(file))}.json`
        )
        let text: string
        try {
          text = readFileSync(sidecar, "utf8")
        } catch {
          console.log(`  skipped ${set}/${file}: no expectation beside it`)
          return []
        }
        // Parsed and read apart, so a trailing comma in a hand-edited
        // expectation is not reported as a missing file sitting right there.
        let expected: Expected
        try {
          expected = JSON.parse(text) as Expected
        } catch (failure) {
          console.log(`  skipped ${set}/${file}: ${String(failure)}`)
          return []
        }
        // The one thing nothing else can check. A rank that sums to seven
        // shifts every square after it and scores every reader against a
        // board a half-step out, silently and for as long as the file lives.
        const squares = asSquares(expected.placement).length
        if (squares !== 64) {
          console.log(
            `  skipped ${set}/${file}: its placement is ${squares} squares, not 64`
          )
          return []
        }
        return [{ set, name: file, read: () => asGray(path), expected }]
      })
  )
}

/** The photograph as the server sees it, or why the server would not have it. */
function asGray(path: string): GrayImage | string {
  const decoded = decode(new Uint8Array(readFileSync(path)))
  if (typeof decoded === "string") return decoded
  return upright(
    rgbaToGray(decoded.data, decoded.width, decoded.height),
    decoded.exif
  )
}

/** A placement field as sixty-four squares, `.` where there is no piece. */
function asSquares(placement: string) {
  return [...placement.replace(/\//g, "")].flatMap((character) =>
    /\d/.test(character)
      ? (Array(Number(character)).fill(".") as Array<string>)
      : [character]
  )
}

/** The shipped model, opened once, as one function from an image and a box. */
async function classifier() {
  const session = await ort.InferenceSession.create(
    createRequire(import.meta.url).resolve(
      "@scoriiu/fenshot/model/chess-tiles-v2.onnx"
    )
  )
  return {
    classify: async (
      image: GrayImage,
      corners: Parameters<typeof extractTiles>[1]
    ) => {
      const answer = await session.run({
        tiles: new ort.Tensor(
          "float32",
          extractTiles(image, corners),
          [64, 1024]
        ),
      })
      return probsToPlacement(answer.probs.data as Float32Array)
    },
    // Released rather than left to the process: `onnxruntime-node` throws out
    // of its own destructor at exit — a recursive_mutex abort and exit 134
    // after every number has printed, which is a run that worked reporting as
    // a run that failed.
    release: () => session.release(),
  }
}

await main()
