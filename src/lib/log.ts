/**
 * The only place in `src/` that calls `console` — `eslint.config.js` holds
 * that. Cloud Run parses a single-line JSON object with a `severity` field
 * into a levelled, filterable entry; that is the whole integration, so this
 * is `console` behind a level gate, not a logging library.
 */

type Level = "debug" | "info" | "warn" | "error"

const ORDER: readonly Level[] = ["debug", "info", "warn", "error"]

function isLevel(value: string | undefined): value is Level {
  return value !== undefined && (ORDER as readonly string[]).includes(value)
}

/**
 * `NODE_ENV` only exists server-side; the browser bundle never reaches it —
 * `typeof window` guards the read rather than an import from
 * `src/lib/env.ts`, which would drag `process.loadEnvFile` into the client.
 */
function isServerProd(): boolean {
  return typeof window === "undefined" && process.env.NODE_ENV === "production"
}

/**
 * `LOG_LEVEL` only exists server-side too. There the level comes from the
 * build mode instead. Read at call time, in both cases: a module-scope read
 * would freeze whatever the environment was on first import.
 */
function floor(): Level {
  if (typeof window === "undefined") {
    if (isLevel(process.env.LOG_LEVEL)) return process.env.LOG_LEVEL
    return isServerProd() ? "info" : "debug"
  }
  return import.meta.env.PROD ? "info" : "debug"
}

const SEVERITY: Record<Level, string> = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
}

/**
 * `build` is a thunk, not a string, so a line below the floor never renders
 * its message — the check below runs before `build()` does.
 */
function write(level: Level, build: () => string): void {
  if (ORDER.indexOf(level) < ORDER.indexOf(floor())) return
  const message = build()
  const line = isServerProd()
    ? JSON.stringify({ severity: SEVERITY[level], message })
    : message
  console[level](line)
}

export const log = {
  debug: (build: () => string) => write("debug", build),
  info: (build: () => string) => write("info", build),
  warn: (build: () => string) => write("warn", build),
  error: (build: () => string) => write("error", build),
}
