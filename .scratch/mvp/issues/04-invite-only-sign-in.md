# 04 — Invite-only sign-in

**What to build:** The one screen a Coach sees before anything else. Email and
password, invite-only: the seeded Coach signs in and reaches the app, and
everyone else has no route in. There is no sign-up route, no password reset and
no email verification — an admin sets passwords by hand for now.

A Student never signs in at all; nothing in the product asks which one you are.

**Blocked by:** 03 — database schema and seed.

**Status:** ready-for-agent

- [ ] The seeded Coach signs in with email and password and lands on the Library
- [ ] A wrong password and an unknown email both fail without revealing which
- [ ] No sign-up, reset or verification route exists anywhere in the app
- [ ] An unauthenticated request to a Coach-only route redirects to Sign in
- [ ] The session survives a full page reload
- [ ] Signing out returns to Sign in and the previous route is no longer reachable
- [ ] `tanstackStartCookies()` is last in the BetterAuth plugins array
- [ ] `pnpm typecheck` and `pnpm lint` pass
