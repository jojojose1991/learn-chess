import { spawn } from "node:child_process"
import { createInterface } from "node:readline"

import { validatePosition } from "@/lib/chess/rules"
import { requireEnv } from "@/lib/env"

import type { Square } from "chess.js"

/**
 * Stockfish, driven over UCI. Server only: the browser downloads no engine
 * (ADR-0003), and this file knows nothing about Goals, Puzzles or games — a
 * Position goes in and a move comes back.
 *
 * The whole protocol is `uci`→`uciok`, `isready`→`readyok`, `position …`,
 * `go movetime …`→`bestmove`, which is why there is no UCI library here: the
 * npm ones are abandoned, and the timeout and the restart are the parts that
 * actually bite (docs/learnings/deployment.md).
 */

/** How long past its own thinking budget a search may run before it is hung. */
const GRACE_MS = 1_000

/**
 * How long a new engine gets to reach `readyok`. Spawn to ready measured
 * ~490 ms, so five seconds is a cold container under load rather than an
 * engine that is never going to answer — and it is a budget of its own,
 * because a slow start is not a hung search.
 */
const STARTUP_MS = 5_000

/**
 * How many searches may be waiting for the one engine before the next caller
 * is turned away. At ~200 ms a move that is about a second and a half of
 * queue, which is the longest wait worth having — and a floor under how much
 * of an instance an unauthenticated caller can hold.
 */
const MAX_WAITING = 8

export type EngineOutcome =
  | { ok: true; from: Square; to: Square; promotion?: "n" | "b" | "r" | "q" }
  | { ok: false; failure: "illegal_position"; reasons: Array<string> }
  | {
      ok: false
      failure: "no_move" | "timeout" | "unavailable" | "busy" | "misconfigured"
    }

/** A search that never produced a move, and which of the two ways it failed. */
class EngineFailed extends Error {
  constructor(readonly failure: "timeout" | "unavailable") {
    super(failure)
  }
}

let engine: ReturnType<typeof spawnEngine> | null = null
let queue: Promise<unknown> = Promise.resolve()
let waitingSearches = 0

/**
 * The move Stockfish would play, or why it did not play one.
 *
 * `movetimeMs` is the server's own budget by default, and a caller passing
 * one is our code rather than a request body: the route is unauthenticated,
 * so a think time from outside is bought CPU.
 */
export async function bestMove(
  fen: string,
  movetimeMs?: number
): Promise<EngineOutcome> {
  const validity = validatePosition(fen)
  if (!validity.ok) {
    return { ok: false, failure: "illegal_position", reasons: validity.reasons }
  }
  if (waitingSearches >= MAX_WAITING) return { ok: false, failure: "busy" }
  const budget = movetimeMs ?? configuredMovetime()
  if (budget === null || configured("STOCKFISH_PATH") === null) {
    return { ok: false, failure: "misconfigured" }
  }
  return enqueue(() => search(fen, budget))
}

/** A server variable, or `null` where the server has not been told. */
function configured(name: string): string | null {
  try {
    return requireEnv(name)
  } catch {
    return null
  }
}

/**
 * The server's own think time, or `null` if it has not got a usable one.
 *
 * Unset, mistyped, or past what a timer can hold, the search runs with no
 * limit against a deadline that has already passed — so every request would
 * time out and kill the engine, which is the failure this exists to stop. A
 * minute is far past any think time a Puzzle wants.
 */
function configuredMovetime(): number | null {
  const movetimeMs = Number(configured("ENGINE_MOVETIME_MS"))
  const usable = Number.isInteger(movetimeMs) && movetimeMs > 0
  return usable && movetimeMs <= 60_000 ? movetimeMs : null
}

/**
 * End the warm engine, so the next request starts a fresh one.
 *
 * A request that met a broken engine calls this; nothing else in the app does,
 * because the container's engine dies with the container.
 */
export function stopEngine(): void {
  engine?.kill()
  engine = null
}

async function search(fen: string, movetimeMs: number): Promise<EngineOutcome> {
  try {
    engine ??= await start()
    engine.send(`position fen ${fen}`)
    engine.send(`go movetime ${movetimeMs}`)
    return readBestMove(await engine.reply("bestmove", movetimeMs + GRACE_MS))
  } catch (error) {
    // Hung or dead, it is not trusted with the next request either.
    stopEngine()
    const failure =
      error instanceof EngineFailed ? error.failure : "unavailable"
    return { ok: false, failure }
  }
}

/**
 * One engine, one pipe, one conversation at a time: a second `go` sent before
 * the first `bestmove` came back would answer the wrong Position.
 *
 * ponytail: a queue, not a pool. A Coach demonstrates to one Student and a
 * Puzzle is a few moves deep, so a second process is ~55 MiB spent on
 * concurrency nobody has measured.
 */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  waitingSearches++
  const run = () => {
    waitingSearches--
    return task()
  }
  const result = queue.then(run, run)
  queue = result.catch(() => undefined)
  return result
}

/**
 * A warm engine: spawned, introduced, and ready to be asked for a move.
 *
 * An engine that never reaches `readyok` is killed here rather than left
 * running unreferenced — at a 377 MiB peak, two of those are the instance —
 * and it is reported as unavailable, because a start that never finished is
 * not a search that ran long.
 */
async function start() {
  const live = spawnEngine()
  try {
    live.send("uci")
    await live.reply("uciok", STARTUP_MS)
    live.send("isready")
    await live.reply("readyok", STARTUP_MS)
    return live
  } catch {
    live.kill()
    throw new EngineFailed("unavailable")
  }
}

function spawnEngine() {
  // stderr is inherited, not piped or dropped: it is where an engine says it
  // cannot run at all — a build whose instructions this CPU has not got dies
  // with SIGILL and one line there — and an unread pipe would eventually
  // block the process it was meant to diagnose.
  const child = spawn(requireEnv("STOCKFISH_PATH"), {
    stdio: ["pipe", "pipe", "inherit"],
  })

  let waiting: ((line: string | null) => void) | null = null
  let down = false

  // `null` is the engine dying: whoever is waiting hears it at once rather
  // than waiting out a budget for a process that is gone, and an engine that
  // died between requests costs nothing — the next request spawns one.
  const died = () => {
    down = true
    if (engine === live) engine = null
    waiting?.(null)
  }
  createInterface({ input: child.stdout }).on("line", (line) =>
    waiting?.(line.trim())
  )
  child.on("exit", died)
  // Never started at all — a `STOCKFISH_PATH` pointing at nothing. Writing to
  // a dead engine's pipe raises EPIPE the same way, and `readline` adds no
  // handler of its own to the stream it reads: an unhandled error on any of
  // the three would take the whole server down with it.
  child.on("error", died)
  child.stdin.on("error", died)
  child.stdout.on("error", died)

  const live = {
    // UCI is line-oriented, so a newline inside a command is a second
    // command. `chess.js` splits a FEN on any whitespace and therefore
    // accepts one carrying a newline, and the Position arrives from an
    // unauthenticated request — so the collapse happens here, where every
    // command goes past, rather than at one caller.
    send: (command: string) => {
      if (!down) child.stdin.write(`${command.replace(/\s+/g, " ")}\n`)
    },
    /** The engine's next line beginning `expected`, or why none came. */
    reply: (expected: string, budgetMs: number) =>
      new Promise<string>((resolve, reject) => {
        if (down) return reject(new EngineFailed("unavailable"))
        const settle = () => {
          clearTimeout(timer)
          waiting = null
        }
        const timer = setTimeout(() => {
          settle()
          reject(new EngineFailed("timeout"))
        }, budgetMs)
        waiting = (line) => {
          if (line === null) {
            settle()
            reject(new EngineFailed("unavailable"))
          } else if (line.startsWith(expected)) {
            settle()
            resolve(line)
          }
        }
      }),
    kill: () => {
      child.kill("SIGKILL")
    },
  }
  return live
}

/** Two squares and an optional promotion piece: `e7e5`, or `a7a8q`. */
const MOVE = /^([a-h][1-8])([a-h][1-8])([nbrq])?$/

/**
 * `bestmove e7e5 ponder d2d4`, or `bestmove (none)` when the side to move is
 * mated or stalemated. UCI names squares and promotion pieces exactly as
 * `chess.js` does, so they cross unchanged — but only once they are a move:
 * `0000` is UCI's null move and a truncated line is neither, and answering
 * `{ from: "00" }` would hand the client something it cannot even reject.
 *
 * Whether the move is *legal* is the client's to say (ADR-0003); this only
 * asks whether it is a move.
 */
function readBestMove(line: string): EngineOutcome {
  const move = MOVE.exec(line.split(/\s+/)[1] ?? "")
  if (!move) return { ok: false, failure: "no_move" }
  const [, from, to, promotion] = move
  return {
    ok: true,
    from: from as Square,
    to: to as Square,
    ...(promotion && { promotion: promotion as "n" | "b" | "r" | "q" }),
  }
}
