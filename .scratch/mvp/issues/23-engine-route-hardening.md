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

**Status:** resolved

- [x] Establish what Cloud Run's own concurrency, timeout and body limits give
      us before any of ours are written
- [x] Decide whether the limit is per-IP, per-Puzzle-Link or per-instance, and
      say why in an ADR if the answer has a trade-off
- [x] A body larger than the limit is refused without being parsed
- [x] A caller over the limit gets an honest status and one error envelope,
      and the queue's existing 503 keeps its meaning
- [x] The engine's own budget is unchanged: nothing here may make a legitimate
      move slower

## Comments

Raised out of ticket 12's code review, not from use — the route has never been
public. Carried forward in `docs/TRACKER.md` with the trigger "a Puzzle Link is
live in production". See `src/lib/engine/service.ts` (`MAX_WAITING`) and
`src/routes/api/engine/move.ts`.

**Answered in [ADR-0007](../../../docs/adr/0007-the-engine-routes-ceiling-is-the-platforms.md)**,
which holds the platform's numbers and the reasoning. In short: the body cap is
built and the rate limit is not, because the CPU ceiling is already
`--max-instances=3` against one serialised engine per instance, and a per-IP
limit inside the container would key on an `X-Forwarded-For` end that Google's
docs do not place in a trust boundary, be enforced at three times its written
rate, and vanish at every scale to zero. The limit goes at Cloud Armor, which
needs a load balancer this service has not got.

**`MAX_WAITING = 8` is unreachable in production and was left at 8.** Four
requests in flight per instance means the ninth caller it turns away cannot
arrive. The queue is the in-process guard and has to be correct without reading
a flag out of `deploy.yml`, so it is not tuned to today's `--concurrency`.

**One review finding was declined.** Ponytail called the "never asks the engine
for a move it refused the body of" test redundant against the 413 test beside
it. It is not: a cap applied *after* the search would answer 413 identically,
and the engine is the only witness out here to "refused without being parsed",
which is this ticket's own criterion.

**Two of this ticket's neighbours could not be closed with it.** No `gcloud` is
installed on the machine this ran on, so the live revision's memory limit and
Cloud Logging's arrival severity are both still unread — the two
`docs/TRACKER.md` rows that named ticket 23 as their trigger. They keep their
rows, retriggered on `gcloud` being in hand rather than on this ticket.
