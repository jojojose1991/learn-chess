import { defineConfig } from "vite"
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
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
