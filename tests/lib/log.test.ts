import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `log` reads `LOG_LEVEL` and the build mode at call time, so every case
 * re-imports the module fresh after stubbing the environment it needs — a
 * module-scope read would only ever see the first test's environment.
 */
async function freshLog() {
  vi.resetModules()
  return import("@/lib/log")
}

describe("log", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {})
    vi.spyOn(console, "info").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("writes at and above the floor, in dev where the floor is debug", async () => {
    const { log } = await freshLog()

    log.debug(() => "debug line")
    log.info(() => "info line")

    expect(console.debug).toHaveBeenCalledWith("debug line")
    expect(console.info).toHaveBeenCalledWith("info line")
  })

  it("raises the floor to info in production when LOG_LEVEL is unset", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { log } = await freshLog()

    log.debug(() => "debug line")
    log.info(() => "info line")

    expect(console.debug).toHaveBeenCalledTimes(0)
    expect(console.info).toHaveBeenCalledWith(
      JSON.stringify({ severity: "INFO", message: "info line" })
    )
  })

  it("honours LOG_LEVEL over the production default", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("LOG_LEVEL", "warn")
    const { log } = await freshLog()

    log.info(() => "info line")
    log.warn(() => "warn line")

    expect(console.info).toHaveBeenCalledTimes(0)
    expect(console.warn).toHaveBeenCalledWith(
      JSON.stringify({ severity: "WARNING", message: "warn line" })
    )
  })

  it("never renders a message below the floor", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const build = vi.fn(() => "expensive")
    const { log } = await freshLog()

    log.debug(build)

    expect(build).toHaveBeenCalledTimes(0)
    expect(console.debug).toHaveBeenCalledTimes(0)
  })

  it("writes one JSON object with a Cloud Logging severity in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { log } = await freshLog()

    log.error(() => "write failed")

    const [line] = vi.mocked(console.error).mock.calls[0] as [string]
    expect(JSON.parse(line)).toEqual({
      severity: "ERROR",
      message: "write failed",
    })
  })

  it("writes plain text in development, for a person reading without a parser", async () => {
    const { log } = await freshLog()

    log.warn(() => "careful")

    expect(console.warn).toHaveBeenCalledWith("careful")
  })
})
