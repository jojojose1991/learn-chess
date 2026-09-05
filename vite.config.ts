import { defineConfig } from "vitest/config"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Vite leaves unprefixed .env variables off `process.env`, so read the file
// ourselves — the same fallback `src/lib/env.ts` uses. `PORT` then drives the
// dev server and Nitro's production server alike (docs/learnings/deployment.md).
try {
  process.loadEnvFile()
} catch {
  // No .env file: the platform supplies the environment.
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: { port: Number(process.env.PORT) || 3012 },
  // `@scoriiu/fenshot`'s own relative imports carry no extensions, which a
  // bundler resolves and Node does not. Left external it is Node that loads
  // it — in the server build and under Vitest alike — and the first import
  // throws ERR_MODULE_NOT_FOUND (docs/learnings/testing.md).
  ssr: { noExternal: ["@scoriiu/fenshot"] },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  test: {
    // Agents read this output: a passing run costs a summary, and console
    // noise survives only from tests that failed.
    silent: "passed-only",
    // By extension, so tests keep mirroring the source path and need no
    // opt-in comment: `.tsx` renders and gets a DOM, `.ts` stays in node.
    projects: [
      {
        extends: true,
        test: {
          name: "logic",
          include: ["tests/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          include: ["tests/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["./tests/setup-dom.ts"],
        },
      },
    ],
  },
})

export default config
