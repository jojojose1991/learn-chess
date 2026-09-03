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
import { eq } from "drizzle-orm"

import { getDb } from "../src/db"
import { user } from "../src/db/schema"
import { ADMIN_ROLE, createAuth, isAdmin } from "../src/lib/auth"
import { requireEnv } from "../src/lib/env"

const email = requireEnv("SEED_ADMIN_USER").toLowerCase()
const db = getDb()

try {
  await seed()
} finally {
  await db.$client.end()
}

async function seed() {
  const rows = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)
  const existing = rows.at(0)

  if (!existing) {
    await createAuth({ signUp: true }).api.signUpEmail({
      body: {
        email,
        password: requireEnv("SEED_ADMIN_PASSWORD"),
        name: requireEnv("SEED_ADMIN_NAME"),
      },
    })
    console.log(`Created Coach ${email}.`)
  } else if (isAdmin(existing)) {
    console.log(`Coach ${email} is already the admin.`)
    return
  }

  // signUpEmail goes through the plugin's `defaultRole` hook, which writes
  // "user" — so the role is granted here either way.
  //
  // ponytail: this replaces the column rather than adding to it, which is
  // lossless only while "user" grants nothing. Merge instead on the day a
  // second role carries product meaning, or re-seeding will silently drop it.
  await db.update(user).set({ role: ADMIN_ROLE }).where(eq(user.email, email))
  console.log(`Coach ${email} is now an admin.`)
}
