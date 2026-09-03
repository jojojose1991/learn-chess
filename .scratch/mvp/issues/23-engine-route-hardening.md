# 23 — What stops a stranger holding the engine open?

**What to decide, then build:** `/api/engine/move` spawns one warm Stockfish
and serves searches from a queue eight deep. Past eight it answers 503 `busy`,
and that queue is the only ceiling on the route — there is no rate limit, and
no cap on the size of a body it will parse. It takes no session, because a
Puzzle Link is played by a Student who has none.

So the exposure is: one instance, one engine, an unauthenticated POST, and a
caller who can keep all of it busy for as long as they care to. Nothing is
wrong today, because nothing is deployed and every caller is us. The premise
changes when a Puzzle Link is live on a public URL (11, 16).

Ticket 12's review declined the two obvious guards, on grounds that stand and
should not be re-argued:

- A `Content-Length` cap stops only the honest — a caller who means harm omits
  the header. A real limit reads the stream, and belongs with the rate limit
  rather than in front of it.
- `Retry-After` has no honest number: a busy queue drains in milliseconds and a
  dead engine respawns on the next request.

What it needs is a decision about where the limit lives, which is why this is
triage and not an agent's next job. Cloud Run has its own concurrency and its
own 32 MiB body ceiling, and a limit in front of the container is not the same
thing as one inside it — one of them is worth building and the other is
already there.

**Blocked by:** 16 — deploy to Cloud Run. The answer depends on what the
platform already enforces.

**Status:** needs-triage

- [ ] Establish what Cloud Run's own concurrency, timeout and body limits give
      us before any of ours are written
- [ ] Decide whether the limit is per-IP, per-Puzzle-Link or per-instance, and
      say why in an ADR if the answer has a trade-off
- [ ] A body larger than the limit is refused without being parsed
- [ ] A caller over the limit gets an honest status and one error envelope,
      and the queue's existing 503 keeps its meaning
- [ ] The engine's own budget is unchanged: nothing here may make a legitimate
      move slower

## Comments

Raised out of ticket 12's code review, not from use — the route has never been
public. Carried forward in `docs/TRACKER.md` with the trigger "a Puzzle Link is
live in production". See `src/lib/engine/service.ts` (`MAX_WAITING`) and
`src/routes/api/engine/move.ts`.
