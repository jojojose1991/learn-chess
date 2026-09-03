import { defineConfig } from "@playwright/test"

import { requireEnv } from "./src/lib/env"

const PORT = 3013

export default defineConfig({
  testDir: "./tests/e2e",
  // One clone is shared by the run, so tests are not isolated from each other.
  workers: 1,
  // `json` and the trace are for a reader that is usually an agent.
  reporter: [["list"], ["json", { outputFile: "test-results/e2e.json" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    // Provisioning belongs here, not in `globalSetup`: Playwright starts the
    // webServer *before* globalSetup, so the server would boot against a
    // database that does not exist yet and `DROP DATABASE … WITH (FORCE)`
    // would then terminate the connections it had opened.
    command: `pnpm e2e:db && pnpm vite dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // The clone, never .env's real DATABASE_URL. `requireEnv` reads .env
      // itself — Playwright does not — and throws rather than passing "",
      // which the server would answer 500 to until the timeout.
      DATABASE_URL: requireEnv("E2E_DATABASE_URL"),
      // Must match baseURL or the session cookie is set for another origin.
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
    },
  },
})
