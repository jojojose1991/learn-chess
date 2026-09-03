let attemptedDotEnv = false

/**
 * Read a server environment variable at call time, never at module scope.
 *
 * In dev Vite leaves unprefixed variables off `process.env`, so fall back to
 * reading `.env` ourselves. In production the platform injects them and there
 * is no file to read.
 */
export function requireEnv(name: string): string {
  // `||`, not `??`: line below treats an empty value as missing too.
  const value = process.env[name] || loadDotEnv()[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
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
