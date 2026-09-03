/**
 * Makes the Coach `SEED_ADMIN_USER` names an admin, creating them first if
 * they do not exist. Invite-only means there is no sign-up route, so this is
 * how the first Coach comes to exist, and admin is a role on that row — so
 * this is also the only thing that grants it. Every other Coach is minted on
 * the accounts screen and gets the plugin's "user" role.
 *
 * Re-running it changes nothing. It does not reset an existing password: the
 * accounts screen does that.
 *
 *   SEED_ADMIN_USER=… SEED_ADMIN_PASSWORD=… SEED_ADMIN_NAME=… pnpm seed
 */
import { getDb } from "../src/db"
import { requireEnv } from "../src/lib/env"
import { seedAdmin } from "./seed-admin"

const db = getDb()

try {
  console.log(
    await seedAdmin(db, {
      email: requireEnv("SEED_ADMIN_USER"),
      password: requireEnv("SEED_ADMIN_PASSWORD"),
      name: requireEnv("SEED_ADMIN_NAME"),
    })
  )
} finally {
  await db.$client.end()
}
