/**
 * The database `pnpm e2e` runs against: a migrated, seeded template, cloned
 * into a throwaway database. `CREATE DATABASE … TEMPLATE` is a file copy, so
 * the clone stays instant however large the fixture grows — the same shape as
 * a Neon branch per run, when that becomes worth an API token.
 */
import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import * as schema from "../src/db/schema"
import { requireEnv } from "../src/lib/env"
import { seedAdmin } from "./seed-admin"

/** Matches `POSTGRES_DB` in docker-compose.yml. Never one of the databases below. */
const MAINTENANCE_DB = "learn-chess"

/** The Coach every e2e run signs in as. Not a secret; this database is disposable. */
export const E2E_ADMIN = {
  email: "coach@e2e.test",
  password: "e2e-password",
  name: "E2E Coach",
}

/** The same server, a different database. */
export function withDatabase(url: string, name: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${name}`
  return parsed.toString()
}

export function databaseName(url: string): string {
  const name = new URL(url).pathname.replace(/^\//, "")
  if (!name) throw new Error("E2E_DATABASE_URL names no database")
  // It is dropped every run, so it cannot be the one holding the connection
  // that issues the DROP.
  if (name === MAINTENANCE_DB)
    throw new Error(
      `E2E_DATABASE_URL must not name "${MAINTENANCE_DB}" — that is the database the provisioner connects to`
    )
  return name
}

if (import.meta.main) await provision()

export async function provision() {
  const url = requireEnv("E2E_DATABASE_URL")
  const runDb = databaseName(url)
  const template = `${runDb}-template`

  const admin = new Pool({
    connectionString: withDatabase(url, MAINTENANCE_DB),
  })
  try {
    // Rebuilt every run rather than cached: measured, migrate + seed on local
    // postgres is 1.8s against 3.0s for a cache hit, because `tsx` startup
    // dominates both. Caching it only added a way to run last week's schema.
    for (const db of [runDb, template])
      await admin.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`)
    await admin.query(`CREATE DATABASE "${template}"`)
    await buildTemplate(withDatabase(url, template))
    await admin.query(`CREATE DATABASE "${runDb}" TEMPLATE "${template}"`)
    console.log(`${runDb} is a fresh clone of ${template}.`)
  } finally {
    await admin.end()
  }
}

async function buildTemplate(url: string) {
  const client = new Pool({ connectionString: url })
  try {
    const db = drizzle(client, { schema })
    await migrate(db, { migrationsFolder: "drizzle" })
    await seedAdmin(db, E2E_ADMIN)
  } finally {
    await client.end()
  }
}
