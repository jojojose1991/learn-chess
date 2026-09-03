/**
 * Grants the admin role to one Coach, creating them first if absent. Shared by
 * `pnpm seed` and the e2e template, so the two cannot drift on what admin is.
 */
import { eq } from "drizzle-orm"

import { user } from "../src/db/schema"
import { ADMIN_ROLE, createAuth, isAdmin } from "../src/lib/auth"

import type { Db } from "../src/db"

type AdminCoach = { email: string; password: string; name: string }

export async function seedAdmin(db: Db, coach: AdminCoach): Promise<string> {
  const email = coach.email.toLowerCase()
  const rows = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)
  const existing = rows.at(0)

  if (!existing) {
    await createAuth({ signUp: true, db }).api.signUpEmail({
      body: { email, password: coach.password, name: coach.name },
    })
  } else if (isAdmin(existing)) {
    return `Coach ${email} is already the admin.`
  }

  // signUpEmail goes through the plugin's `defaultRole` hook, which writes
  // "user" — so the role is granted here either way.
  //
  // ponytail: this replaces the column rather than adding to it, which is
  // lossless only while "user" grants nothing. Merge instead on the day a
  // second role carries product meaning, or re-seeding will silently drop it.
  await db.update(user).set({ role: ADMIN_ROLE }).where(eq(user.email, email))
  return `Coach ${email} is now an admin.`
}
