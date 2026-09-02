/**
 * Creates the first Coach. Invite-only means there is no sign-up route, so
 * this is how a Coach comes to exist. Re-running it is a no-op.
 *
 *   SEED_COACH_EMAIL=… SEED_COACH_PASSWORD=… SEED_COACH_NAME=… pnpm seed
 */
import { eq } from "drizzle-orm"

import { getDb } from "../src/db"
import { user } from "../src/db/schema"
import { createAuth } from "../src/lib/auth"
import { requireEnv } from "../src/lib/env"

const email = requireEnv("SEED_COACH_EMAIL").toLowerCase()
const db = getDb()

try {
  await seed()
} finally {
  await db.$client.end()
}

async function seed() {
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  if (existing.length > 0) {
    console.log(`Coach ${email} already exists.`)
    return
  }

  await createAuth({ signUp: true }).api.signUpEmail({
    body: {
      email,
      password: requireEnv("SEED_COACH_PASSWORD"),
      name: requireEnv("SEED_COACH_NAME"),
    },
  })
  console.log(`Created Coach ${email}.`)
}
