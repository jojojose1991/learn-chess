# 18 — Admin: the accounts screen

**What to build:** The screen an admin uses to keep Coach accounts, so
"invite-only" stops meaning "ssh in and run a script". It lists every account
with its email, its name and how many Puzzles it owns; it adds a Coach with an
initial password; it sets a new password on an existing one; and it revokes and
restores access. It never deletes.

**Nothing is removed, ever.** `puzzle.coach_id` cascades, and `puzzle_link`
cascades off that, so one delete would take a Coach's whole Library and every
Puzzle Link a Student is holding. Revoking is the operation instead: every live
session dies, sign-in stops working, the row and its Puzzles stay. The cascade
stays in the schema as the backstop it already is, unreachable from the product.

**An admin is not a third kind of person.** Coach and Student remain
perspectives on one interface (CONTEXT.md). An admin is one Coach named by
email in `SEED_ADMIN_USER`, so admin-ness is deploy configuration and not
data — nothing in the product asks who you are, no promote or demote exists,
and no app code reads a role.

**Blocked by:** 04 — invite-only sign-in (resolved).

**Status:** resolved

- [x] `/admin` lists every account: email, name, Puzzle count, and whether access is revoked
- [x] Adding a Coach takes an email, a name and an initial password, and that Coach can then sign in
- [x] Setting a new password revokes every session that Coach had — their old cookie stops working
- [x] Revoking access kills every live session and makes sign-in fail; restoring lets them back in
- [x] No account can be deleted anywhere in the app, and no UI path reaches the `coach_id` cascade
- [x] An admin cannot revoke their own access
- [x] A signed-in Coach who is not an admin gets a 404 from `/admin`, not merely a hidden link
- [x] A signed-out request to `/admin` redirects to Sign in, like any Coach-only route
- [x] `admin()` sits before `tanstackStartCookies()`, which is still last in the plugins array
- [x] Admin-ness comes from `SEED_ADMIN_USER` alone; no app code reads `user.role`
- [x] The migration adds only nullable columns, applies cleanly to Neon, and re-running it is a no-op
- [x] `CONTEXT.md` defines Admin and Revoked; `docs/PLAN.md` lists the seventh screen; `.env.example` documents `SEED_ADMIN_USER`; `docs/BACKLOG.md`'s "admin sets passwords by hand" line is updated
- [x] `pnpm typecheck`, `pnpm lint` and `pnpm test` pass

## What the library already does

Verified in `better-auth@1.7.2`'s shipped `dist/`, not from its docs:

- **`createUser`** makes the user and the credential account, so it needs no
  hole in `disableSignUp`. **`banUser`** sets `banned` *and* calls
  `deleteUserSessions`, and refuses to ban the caller
  (`YOU_CANNOT_BAN_YOURSELF`) — so "an admin cannot revoke themselves" is
  enforced server-side whatever the UI does. Ban is re-checked on session
  create, so a revoked Coach cannot sign back in. **`unbanUser`** restores.
- ⚠️ **`setUserPassword` does not revoke sessions.** It only rewrites the
  credential row, so a Coach signed in elsewhere stays signed in on the old
  password. Follow it with `revokeUserSessions` — this is the one criterion
  above that the plugin will not give you for free.
- ⚠️ The plugin's `defaultRole` hook writes `role` on every user create even
  when `adminUserIds` makes roles irrelevant to permissions, so the column is
  required regardless of our not reading it.
- **`listUsers` returns no Puzzle counts.** Read the list with our own Drizzle
  query (`left join puzzle`, `count`) and use the plugin only for the writes.
- Mounting the plugin also opens `/admin/impersonate-user`, `/admin/set-role`
  and the session-listing endpoints. They are admin-gated, so the exposure is
  bounded by the admin's own credentials, but nothing in the product should
  call them and `impersonate` in particular has no business here.

## Bootstrap

**Changed during implementation, on the maintainer's call.** The ticket planned
`ADMIN_USER_IDS`, holding user ids: `pnpm seed`, read the id it made, paste it
into `.env`, restart. That variable is gone. The admin is named by email in
`SEED_ADMIN_USER`, which is the same variable `pnpm seed` reads to create them,
so the whole bootstrap is: fill in `SEED_ADMIN_USER`, `SEED_ADMIN_PASSWORD` and
`SEED_ADMIN_NAME`, run `pnpm seed`, sign in. No id to copy and no restart.

The cost is that only one account can be the admin, and that `pnpm seed` now
has a second job — it names the admin as well as creating them. Both were
accepted deliberately.

## Deliberately not here

- **Self-service password reset.** Still `docs/BACKLOG.md`, still blocked on a
  verified Resend domain. This screen is the "admin sets passwords by hand"
  that the backlog names, so it does not unblock or replace that entry.
- **Public sign-up, email verification, rate limits.** Unchanged: invite-only.
- **Roles, permissions, promote/demote, impersonation.** An account is a Coach;
  one of them is named in an env var.
- **Timed revocation.** `banExpires` exists in the plugin; pass nothing, so a
  revocation lasts until someone restores it.


## Comments

**`SEED_ADMIN_USER` replaced `ADMIN_USER_IDS`** (see Bootstrap). Two criteria
above were rewritten to match. Everything else the ticket asked for stands.

**The plugin only takes user ids, so the email is resolved to one.** `getAuth()`
is now async: it looks the admin's id up by email and builds the instance with
it. Until `pnpm seed` has made that Coach there is no id to find and the answer
is *not* cached, so the first sign-in after seeding picks it up with no restart
— which is the whole point of the change. Once found it is memoized as before.

The product's own gate does not use the id at all: `isAdmin()` compares the
session's email to `SEED_ADMIN_USER`. Both gates answer to the one variable, so
they cannot drift.

**`set-role` is refused too, and that one matters more than it looks.** The
ticket says no app code reads `user.role`, and none does — but the *plugin*
does: `hasPermission` grants on role before anything else, so a Coach whose
role said "admin" would hold every admin endpoint while `/admin` still answered
them 404. That is a second definition of admin the product cannot see. Closing
`/admin/set-role` leaves no HTTP path that writes the column, so the two cannot
disagree. `src/routes/api/auth/-closed.test.ts` pins all three refusals.

The admin can still mint a role-carrying account through the raw `create-user`
endpoint, which takes a `role` in its body. That grants no power the admin does
not already hold, and `addCoach` never passes one, so it is left alone.

**`removeUser` and `impersonateUser` are refused at the route.** The ticket
noted the plugin mounts endpoints we do not want and that they are admin-gated.
`/admin/remove-user` is not merely unwanted — it reaches the `coach_id`
cascade, which is the one thing this ticket exists to prevent, so a signed-in
admin should not be one curl away from it either. `src/routes/api/auth/$.ts`
answers 404 to both before the handler sees them.

**What the tests pin, and what was checked by hand.** `src/lib/auth.test.ts`
pins the configuration that would silently rot: `admin()` ahead of
`tanstackStartCookies()` with the cookie plugin still last, and `isAdmin()`
answering to `SEED_ADMIN_USER` alone — including the unset case a fresh clone
is in, where nobody is admin and nothing throws.

The behaviour was verified against the real database and a running dev server,
with throwaway Coaches that were then deleted:

- signed out `GET /admin` → `307` to `/sign-in`; a signed-in non-admin Coach →
  `404`, while their Library still answered `200`
- the admin's `/admin` → `200`, server-rendered, listing every account with
  name, email, Puzzle count and Active/Revoked
- `create-user` → `200`, and that Coach signed in immediately, with the
  sign-up endpoint still closed
- **the ticket's warning about `setUserPassword` is real and was measured**:
  after `set-user-password` alone the Coach's old cookie still answered `200`;
  only after the follow-up `revoke-user-sessions` did it become `307`. The old
  password was then rejected `401` and the new one accepted `200`
- `ban-user` → their live session `307` and sign-in refused `BANNED_USER`;
  `unban-user` → signing in again `200`. The row and its Puzzles stayed
- banning oneself → `YOU_CANNOT_BAN_YOURSELF`, and the UI shows "This is you"
  in place of the button
- `POST /api/auth/admin/remove-user` and `/admin/impersonate-user` → `404`
- the migration applied to Neon and a second `pnpm db:migrate` was a no-op

**The plugin does write `role`.** The seeded Coach came back with `role: "user"`
— the `defaultRole` hook, exactly as the ticket predicted. Nothing reads it.

**A DOM test would need `environment: "jsdom"` in `vite.config.ts`**, which no
screen needs yet. The screen's own logic is a list and four form submits over
server functions that are thin wrappers around the plugin, so the checks above
cover it.
