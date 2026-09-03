import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// One directory for every run there will ever be, with the process in each
// name so parallel test files cannot collide. Deleting it on exit is what a
// tidier version would do, and it would race the other worker still using
// it — vitest kills workers, so the hook does not reliably run anyway.
const home = join(tmpdir(), "learn-chess-fake-engines")
mkdirSync(home, { recursive: true })
let made = 0

/**
 * An executable that speaks UCI and is not Stockfish.
 *
 * The engine driver's job is a real process on a real pipe — spawning it,
 * reading its lines, timing it out, noticing it die — so the tests give it
 * one. Nothing about the driver is stubbed: only the program on the far end
 * of the pipe is ours, which is the same trust boundary a Coach's container
 * has. Stockfish itself cannot be asked to hang or to die on command.
 *
 * It stands in for Stockfish and for nothing else. What it cannot stand in
 * for is a move being legal, which is why the real binary has a test of its
 * own — every other test here asks what our driver does when a process on the
 * far end answers late, twice, oddly, or not at all.
 *
 * `go` is the only command the caller has to answer, because `uci` and
 * `isready` have one correct reply and nothing interesting to say. In scope:
 * `say(line)` writes a line back, and `n` counts the `go` commands this
 * executable has been sent before this one, across restarts as well as within
 * a run — which is how a fake can die the first time and answer the second.
 */
export function fakeEngine(onGo: string): string {
  const path = join(home, `engine-${process.pid}-${++made}`)
  writeFileSync(
    path,
    `#!/usr/bin/env node
const { appendFileSync, readFileSync } = require("node:fs")
const { createInterface } = require("node:readline")
const log = ${JSON.stringify(`${path}.log`)}
const say = (line) => process.stdout.write(line + "\\n")
const countGos = () =>
  readFileSync(log, "utf8").split("\\n").filter((l) => l.startsWith("go")).length

createInterface({ input: process.stdin })
  .on("line", (raw) => {
    const line = raw.trim()
    appendFileSync(log, line + "\\n")
    if (line === "uci") say("uciok")
    else if (line === "isready") say("readyok")
    else if (line.startsWith("go")) {
      const n = countGos() - 1
      ${onGo}
    }
  })
  // The parent holding the pipe is what keeps this alive; nothing else should.
  .on("close", () => process.exit(0))
`,
    { mode: 0o755 }
  )
  writeFileSync(`${path}.log`, "")
  return path
}

/** Every command the fake engine has been sent, oldest first. */
export function commandsSent(path: string): Array<string> {
  return readFileSync(`${path}.log`, "utf8").split("\n").slice(0, -1)
}
