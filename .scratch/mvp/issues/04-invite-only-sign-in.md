# 04 — Invite-only sign-in

**What to build:** The one screen a Coach sees before anything else. Email and
password, invite-only: the seeded Coach signs in and reaches the app, and
everyone else has no route in. There is no sign-up route, no password reset and
no email verification — an admin sets passwords by hand for now.

A Student never signs in at all; nothing in the product asks which one you are.

**Blocked by:** 03 — database schema and seed.

**Status:** resolved

- [x] The seeded Coach signs in with email and password and lands on the Library
- [x] A wrong password and an unknown email both fail without revealing which
- [x] No sign-up, reset or verification route exists anywhere in the app
- [x] An unauthenticated request to a Coach-only route redirects to Sign in
- [x] The session survives a full page reload
- [x] Signing out returns to Sign in and the previous route is no longer reachable
- [x] `tanstackStartCookies()` is last in the BetterAuth plugins array
- [x] `pnpm typecheck` and `pnpm lint` pass

## Comments

The Coach-only surface is one pathless layout, `src/routes/_coach.tsx`, whose
`beforeLoad` reads the session on the server and throws a redirect to
`/sign-in`. Everything a Coach must be signed in to see goes under it, so the
guard is written once. The Library sits at `/` (`src/routes/_coach/index.tsx`)
rather than at `/library`, which removes a redirect route: signing in and the
bare origin land in the same place.

`fetchCoach` (`src/lib/session.ts`) is a **POST** server function, not the
default GET. A GET response with no `Cache-Control` is heuristically cacheable,
and a browser serving a stale session after sign-out would leave a signed-out
Coach looking signed in. Sign-out calls `router.invalidate()` before navigating
for the same reason.

**Both failure modes were already indistinguishable in the library**, so the
single message in the UI is not the only thing hiding them: BetterAuth throws
the same `INVALID_EMAIL_OR_PASSWORD` for an unknown email, a missing credential
row and a wrong password, and hashes a dummy password on the first two so the
timing matches (`better-auth/dist/api/routes/sign-in.mjs`).

**What the tests pin, and what was checked by hand.** `src/lib/auth.test.ts`
pins the three things that are configuration and would silently rot: the
sign-up endpoint is closed, password reset is closed, and
`tanstackStartCookies()` is last in the plugins array. The four navigation and
session criteria were verified against the real database with a throwaway Coach
seeded and then deleted: `GET /` signed out → `307` to `/sign-in`; sign-in →
`200` with a session cookie; `GET /` with that cookie → `200` and
server-rendered Library; sign-out → `200`, then `GET /` → `307` to `/sign-in`
again. `POST /api/auth/sign-up/email` → `400 EMAIL_PASSWORD_SIGN_UP_DISABLED`.
A DOM test would need `environment: "jsdom"` in `vite.config.ts`, which no
screen needs yet.

`/api/auth/request-password-reset` and `/api/auth/send-verification-email` still
answer, because the route mounts BetterAuth's whole handler — they reject
because no `sendResetPassword`/`sendVerificationEmail` is configured. The reset
test pins that; there is no route, screen or link to either anywhere in the app.

Deliberately not added: `shadcn`'s `field` component. It arrived with
`pnpm dlx shadcn@latest add`, brought `separator` with it, and 237 lines of ten
exports served two labels — `Label` and `Input` do the job. Add it back when a
form needs more than a stacked label.

**The screen's presentation was settled outside any ticket.** The wordmark, the
scrim joining the form to the photo and the palette they sit on are app-wide
theming, done in one pass across the signed-out and Library screens rather than
reopened here. `docs/adr/0005-brand-green-is-not-the-button-colour.md` holds the
colour decisions and `docs/learnings/typography.md` the type; the Coach's own
board-theme preference became ticket 19.
