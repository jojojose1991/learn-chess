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
perspectives on one interface (CONTEXT.md). An admin is one Coach whose user id
is named in `ADMIN_USER_IDS`, so admin-ness is deploy configuration and not
data — nothing in the product asks who you are, no promote or demote exists,
and no app code reads a role.

**Blocked by:** 04 — invite-only sign-in (resolved).

**Status:** claimed

- [ ] `/admin` lists every account: email, name, Puzzle count, and whether access is revoked
- [ ] Adding a Coach takes an email, a name and an initial password, and that Coach can then sign in
- [ ] Setting a new password revokes every session that Coach had — their old cookie stops working
- [ ] Revoking access kills every live session and makes sign-in fail; restoring lets them back in
- [ ] No account can be deleted anywhere in the app, and no UI path reaches the `coach_id` cascade
- [ ] An admin cannot revoke their own access
- [ ] A signed-in Coach who is not an admin gets a 404 from `/admin`, not merely a hidden link
- [ ] A signed-out request to `/admin` redirects to Sign in, like any Coach-only route
- [ ] `admin()` sits before `tanstackStartCookies()`, which is still last in the plugins array
- [ ] Admin-ness comes from `ADMIN_USER_IDS` alone; no app code reads `user.role`
- [ ] The migration adds only nullable columns, applies cleanly to Neon, and re-running it is a no-op
- [ ] `CONTEXT.md` defines Admin and Revoked; `docs/PLAN.md` lists the seventh screen; `.env.example` documents `ADMIN_USER_IDS`; `docs/BACKLOG.md`'s "admin sets passwords by hand" line is updated
- [ ] `pnpm typecheck`, `pnpm lint` and `pnpm test` pass

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

`ADMIN_USER_IDS` needs a user id that only exists once a Coach does, so the
order is: `pnpm seed`, read that Coach's id, put it in `.env`, restart. Say so
in `.env.example`, because a fresh clone hits it immediately. `pnpm seed` stays
as the bootstrap path and does not become dead weight — it is what creates the
first account before any admin exists to create one.

## Deliberately not here

- **Self-service password reset.** Still `docs/BACKLOG.md`, still blocked on a
  verified Resend domain. This screen is the "admin sets passwords by hand"
  that the backlog names, so it does not unblock or replace that entry.
- **Public sign-up, email verification, rate limits.** Unchanged: invite-only.
- **Roles, permissions, promote/demote, impersonation.** An account is a Coach;
  one of them is named in an env var.
- **Timed revocation.** `banExpires` exists in the plugin; pass nothing, so a
  revocation lasts until someone restores it.
