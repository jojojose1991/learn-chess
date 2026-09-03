# 19 — Logging, in development and in production

**What to build:** One module that decides whether a line is written and what
shape it has, so a failure leaves evidence somewhere other than the screen the
person was looking at.

**Not a logging library.** Cloud Run collects stdout and stderr into Cloud
Logging by itself, and parses a single-line JSON object with a `severity` field
into a levelled, filterable entry. That is the whole integration: `console`
behind a level gate, one shape in prod and a readable one in dev. Nothing new
is installed.

**Two paths already swallow what someone would want.** `attempt()` in
`src/lib/accounts/service.ts` hands BetterAuth's message to the admin and keeps
nothing server-side, so a failed write leaves no trace once they close the tab.
`withDb`'s Neon retry is invisible, so "it was slow once" has no evidence
either way.

**On the client the ceiling is the browser console.** There is no error
reporting service in the MVP — Sentry is not installed and is not being added —
so a Student's failure is visible only if a Coach describes it. What this
ticket buys on that side is narrow and worth having anyway: debug lines that
were useful while building do not ship to a Student's phone.

**Blocked by:** nothing.

**Status:** ready-for-agent

- [ ] `src/lib/log.ts` is the only place in `src/` that calls `console`, and lint keeps it that way
- [ ] `LOG_LEVEL` sets the floor, read at call time and never at module scope; unset means `debug` in dev and `info` in prod
- [ ] In production a line is one JSON object with a `severity` Cloud Logging recognises; in dev it is plain text a person reads without a parser
- [ ] A line below the floor calls nothing and builds no message — an argument that is expensive to render is not rendered
- [ ] The same module works in the browser, where the level comes from the build mode, and pulls no server import into the client bundle
- [ ] No password, session token, secret or full request body is ever written; a credential-carrying operation logs what failed, not what was sent
- [ ] `attempt()` logs the error it converts, before returning the admin their message
- [ ] `withDb` logs when the retry fires, so a Neon resume is visible afterwards
- [ ] `.env.example` documents `LOG_LEVEL` with what each level means here
- [ ] `pnpm typecheck`, `pnpm lint` and `pnpm test` pass

## Deliberately not here

- **A per-request correlation id.** One small service, one admin, low traffic;
  interleaved requests are not yet confusing. It arrives when two people's
  lines cannot be told apart in one log.
- **An error reporting service, log-based alerts, and dashboards.** Prod-only
  with no staging (`docs/BACKLOG.md`) and a handful of users. Cloud Logging's
  own search is the tool until someone is asking a question it cannot answer.
- **An audit trail of admin actions.** That is a table, not a log line, and no
  requirement names it.
- **Request/response access logging.** Cloud Run already logs every request.
