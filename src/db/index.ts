import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { requireEnv } from "@/lib/env"
import * as schema from "./schema"

export type Db = ReturnType<typeof connect>

let db: Db | undefined

/**
 * The pool, built on first use so the connection string is read when a
 * request needs it rather than when this module is imported.
 *
 * `max: 5` because the pool is a queue, not a throughput cap — a fat pool
 * across many Cloud Run instances exhausts Neon's transaction budget.
 */
function connect() {
  const pool = new Pool({
    connectionString: requireEnv("DATABASE_URL"),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
  // An idle client that errors with no listener takes the whole process down.
  pool.on("error", (error) => {
    console.error("postgres pool error", error)
  })
  return drizzle(pool, { schema })
}

export function getDb(): Db {
  return (db ??= connect())
}

/** Postgres and libpq codes that mean "the connection went away". */
const connectionErrors = new Set([
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "08006", // connection_failure
  "08003", // connection_does_not_exist
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
])

/**
 * drizzle wraps every driver error in a `DrizzleQueryError` and hangs the `pg`
 * error off `.cause`, so the code is never on the error we are handed. Walk
 * the chain rather than reading one level.
 */
function isConnectionError(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && depth < 5; depth++) {
    const { code, cause } = current as { code?: unknown; cause?: unknown }
    if (typeof code === "string" && connectionErrors.has(code)) return true
    current = cause
  }
  return false
}

/**
 * Run a query, retrying once if the connection itself failed. Neon scales its
 * compute to zero after five minutes idle, so the first query after a quiet
 * spell can meet a dead pooled connection before the compute resumes.
 *
 * ponytail: the retry does not tell "died before the statement was sent" from
 * "died while the reply was read", so a write could in principle be applied
 * twice. The Neon-resume case this exists for fails before sending. Split
 * reads from writes if a duplicate ever shows up.
 */
export async function withDb<T>(query: (db: Db) => Promise<T>): Promise<T> {
  try {
    return await query(getDb())
  } catch (error) {
    if (!isConnectionError(error)) throw error
    return await query(getDb())
  }
}
