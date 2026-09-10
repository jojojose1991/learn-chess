# The engine route bounds its body, and the platform bounds its CPU

`/api/engine/move` is unauthenticated by design — a Puzzle Link is played by a
Student who has no session — so it caps the size of a body it will read, and it
gets no rate limit inside the container. Rate limiting belongs in front of the
container, and until something is in front of the container there is none.

## Why

**What the platform already gives us**, read from Cloud Run's quotas and from
`.github/workflows/deploy.yml` rather than assumed:

| | Value | Where from |
| --- | --- | --- |
| Request body | **32 MiB** on HTTP/1, **no limit** on HTTP/2 | Cloud Run quotas |
| Request timeout | 120 s | `--timeout=120` |
| Concurrent requests per instance | 4 | `--concurrency=4` |
| Instances | 0–3 | `--min-instances`, `--max-instances` |
| Rate limit | **none** | a bare `run.app` URL has no Cloud Armor in front of it |

**The body is the one real gap, so it is the one thing built.** The argument
does not need the 32 MiB: **on HTTP/2 the platform bounds a body not at all**,
and `request.json()` has to buffer whatever arrives before it can discover the
shape is wrong. Even on HTTP/1, 32 MiB is hundreds of thousands of times a FEN
and `--concurrency=4` permits four at once — call that plausibly fatal in 1 GiB
beside Stockfish's measured 377 MiB peak and Node's 40–70 MiB, rather than
arithmetic anyone has run. The unbounded case is the one that decides it.

So the route counts bytes as they arrive and refuses past a kibibyte, an order
of magnitude past any honest caller and before the parse. Counted, not read off
`Content-Length`: ticket 12's review declined the header on its own because a
caller who means harm omits it, and a chunked body has not got one at all.

**This is one guard, not a second one.** `/api/scan` already counted its own
uploads the same way, so the rule now lives once in `src/lib/http.ts` with both
routes passing their own cap to it, and `tests/lib/http.test.ts` holds the
counting — the accumulation across chunks, the boundary, and the body with no
end that tells a counted read apart from a buffered one measured afterwards.

**The CPU ceiling is already `--max-instances`.** One engine per instance and a
queue that serialises searches means the route's whole cost is three cores at
once, whatever a caller does. A stranger holding it open buys 503s, not
capacity — the queue's existing answer, unchanged.

**An in-container per-IP limit would be worse than nothing.** Three reasons,
each on its own sufficient:

- **The key is not trustworthy.** It would have to be `X-Forwarded-For`, and
  Google's own docs do not say whether Cloud Run appends the client IP to a
  client-supplied header or prepends it. Leftmost is spoofable if it appends;
  rightmost is spoofable if it prepends. A limit keyed on a header we cannot
  place in a trust boundary is a limit an abuser steps around by setting it.
- **It would not be one limit.** In-memory state is per instance and Cloud Run
  spreads requests across up to three, so any rate written would be enforced at
  three times its number — and at `--min-instances=0` the state is gone
  whenever the service scales to zero.
- **It buys no ceiling that is missing.** The cost is already bounded above;
  what a per-IP limit would buy is fairness between callers, and a botnet
  defeats it at the only layer that could tell.

**`MAX_WAITING = 8` is unreachable in production, and stays 8.** With four
requests in flight per instance the ninth caller the queue turns away cannot
arrive. The queue is the in-process guard and has to be correct without reading
a flag out of a YAML file, so it is not tuned to today's `--concurrency`.

## Consequences

- A body over 1 KiB gets **413** in the one error envelope. The queue's 503
  keeps its meaning: busy, not too big and not broken.
- A legitimate move is unchanged — one small chunk, one decode, no new I/O and
  no new state.
- **The rate limit is owed, not declined for good.** It goes at Cloud Armor,
  which needs a load balancer in front of the service; `docs/TRACKER.md` carries
  it with a measurement as its trigger.
- **Two facts here are unverified against the running service**, because no
  `gcloud` was in hand: the live revision's memory limit, and whether Cloud Run
  appends or prepends `X-Forwarded-For`. Both are `docs/TRACKER.md` rows. The
  second only matters if the previous point is ever answered inside the
  container instead.
