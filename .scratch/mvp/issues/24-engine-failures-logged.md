# 24 — The engine's failures are visible somewhere

**What to build:** `src/lib/engine/service.ts` calls `log` (`src/lib/log.ts`,
ticket 19) when a search times out, the Stockfish process dies, or it is
restarted, so a bad run leaves a line instead of only a symptom on screen.

**Why now:** Ticket 19 built the module and wired the two paths it named —
`attempt()` and `withDb` — but named this as a third path left unlit, deferred
because the engine's own error handling wasn't the ticket's scope. It's the
`19` row in `docs/TRACKER.md`'s carried-forward table.

**Blocked by:** nothing — `src/lib/log.ts` exists.

**Status:** ready-for-agent

- [ ] A search that hits `ENGINE_MOVETIME_MS` and is killed logs a warning naming the FEN or move count, not the full request
- [ ] A Stockfish process exit (crash) logs an error before the pool restarts it
- [ ] A restart itself logs, so "it was slow once" and "it died once" read differently in Cloud Logging
- [ ] No log line carries anything a Student's device sent that isn't already safe to store (position/move data is fine; no headers, no session/auth material)
- [ ] `pnpm typecheck`, `pnpm lint` and `pnpm test` pass
