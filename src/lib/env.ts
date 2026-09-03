let attemptedDotEnv = false

/**
 * Read a server environment variable at call time, never at module scope.
 *
 * In dev Vite leaves unprefixed variables off `process.env`, so fall back to
 * reading `.env` ourselves. In production the platform injects them and there
 * is no file to read.
 */
export function requireEnv(name: string): string {
  const value = optionalEnv(name)
  if (!value) throw new Error(`${name} is not set`)
  return value
}

/** The same lookup, where unset is an answer rather than a failure. */
export function optionalEnv(name: string): string | undefined {
  // `||`, not `??`: an empty value counts as missing too.
  return process.env[name] || loadDotEnv()[name] || undefined
}

function loadDotEnv(): NodeJS.ProcessEnv {
  if (!attemptedDotEnv) {
    attemptedDotEnv = true
    try {
      process.loadEnvFile()
    } catch {
      // No .env file: the platform supplies the environment.
    }
  }
  return process.env
}
