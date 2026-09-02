import { defineConfig } from "drizzle-kit"

import { requireEnv } from "./src/lib/env"

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // Direct, not pooled: Neon documents the unpooled endpoint for DDL.
  dbCredentials: { url: requireEnv("DATABASE_URL_UNPOOLED") },
})
