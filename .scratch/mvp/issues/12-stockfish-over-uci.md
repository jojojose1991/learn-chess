# 12 — Stockfish over UCI behind an engine route

**What to build:** The server side of playing an opponent. A native Stockfish
in the container, driven over UCI, exposed as one stateless route: give it a
Position and a think time, get back a move. Nothing about Goals or games
reaches this layer.

Stockfish and Scan run on the server, not as wasm in the browser (ADR-0003) —
the browser downloads neither.

Facts already measured, not to be re-litigated: spawn to `readyok` is ~490 ms,
so one process stays warm rather than spawning per request. Skip the npm UCI
wrappers; `child_process.spawn` plus `readline` is about 30 lines and leaves us
owning the timeout and restart behaviour. Install from the official
`stockfish-ubuntu-x86-64-avx2` tarball, not apt, because Debian's build has no
AVX2 and NNUE evaluation is where the move-time budget goes. It needs Debian
glibc and will not run on Alpine.

The Dockerfile becomes honest here rather than at deploy time.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] `bestMove(fen, movetimeMs)` returns a legal move for a given Position
- [x] One long-lived process serves many requests; a second request does not pay spawn cost
- [x] A crashed or hung engine is detected and restarted rather than wedging the route
- [x] A request that exceeds its budget fails cleanly instead of hanging
- [x] The engine route validates its input Position and refuses an illegal one
- [x] A Dockerfile builds an image with Stockfish present, from the AVX2 tarball, on a Debian-slim Node 24 base
- [x] The engine runs inside that image with ≥1 GiB of memory available
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

Built and reviewed 2026-09-03. `src/lib/engine/service.ts` is the driver,
`src/routes/api/engine/move.ts` the one route, and the image is the repo's
first `Dockerfile`.

**What was verified by running it**, not reasoned about:

- `docker build` succeeds and `docker run --rm --memory 1g <image>` reports
  `Compilation architecture: x86-64-avx2`, `node v24.20.0`, `x86_64`, and
  answers `uciok` / `readyok` / `bestmove` to a real search. Emulated on an
  arm64 host, which is how the numbers in `docs/learnings/deployment.md` were
  taken too.
- Over HTTP against `pnpm dev` with the real Stockfish: a legal Position
  → `200 {"from":"e2","to":"e4"}`; `8/8/8/8/8/8/8/8 w - - 0 1` → `422`
  `{"error":"White has no king."}`; `{}` and `nonsense` → `400`; a mated
  Position → `409`. A warm second request round-trips in **209 ms** on a
  200 ms budget, so the ~490 ms spawn is paid once and not per move.

**A defect the review caught, fixed with a test.** `chess.js` splits a FEN on
any whitespace, so `"… w - - 0\n1"` is a *legal* Position carrying a newline —
and UCI is line-oriented, so `position fen …` became two commands with the
second under the caller's control. Seen red: the fake engine's log showed
`position fen … 0` followed by a stray `1`. The collapse now happens in
`send`, where every command passes, rather than at the one caller.

**Two tests were rewritten because they proved nothing.** "Serves a second
request from the same engine" and "answers overlapping requests one at a
time" both passed against a spawn-per-request implementation, because the fake
engine's counter lives in a file that survives a restart. They now assert the
number of `uci` handshakes, and were checked red against two mutations:
`engine ??= await start()` → `engine = await start()`, and `enqueue` reduced to
calling its task directly.

**Findings declined, with reasons:**

- *Validate the engine's own `bestmove` with `applyMove` and reject a move
  that is not legal.* ADR-0003 makes the client the authority on legality, so
  a corrupt move is rejected there; checking it twice is the same rule in two
  places. The parse itself is pinned by the promotion and `(none)` tests.
- *`ucinewgame` between Positions, so the transposition table does not carry
  across requests.* A defender that answers a repeated Position differently is
  not a defect — nothing records a game, and the Goal is a predicate over the
  board, not a line. Carried forward instead, with its trigger.
- *Reject a FEN outside `[A-Za-z0-9/\- ]` rather than collapsing whitespace.*
  The Position is legal by `validatePosition`; refusing it would be inventing
  a second, narrower definition of legal one layer down.
- *`Retry-After` on the 503s.* There is no honest number to put in it: a busy
  queue drains in milliseconds and a dead engine respawns on the next request.
- *Reject non-Error rejections / drop the `EngineFailed` class for a string.*
  The class is what tells our two expected failures from a genuine bug, and a
  thrown string loses the stack exactly where one is wanted.
- *Cap the body with `Content-Length` before parsing it.* A caller who means
  harm omits the header, so the guard stops only the honest. The real ceiling
  is Cloud Run's 32 MiB, and a limit that reads the stream belongs with the
  rate limit the tracker already owes.
- *Short-circuit the queue while a start is known to be failing.* Eight
  queued searches behind an engine that never reaches `readyok` each wait out
  the 5 s startup, so the eighth answers after ~40 s. Real, and the fix is
  four lines — but every one of them sits on the one path nothing here can
  test without a five-second test. Carried forward rather than shipped
  untested.
- *Rethrow anything that is not an `EngineFailed`.* Taken in part: a server
  with no think time or no engine path now answers `misconfigured` → 500,
  which is what that finding was mostly about. An error nobody has attributed
  still reports `unavailable`, because from the outside an engine we cannot
  drive is exactly that; ticket 19 is what gives it a log line.

**One thing that cannot be tested here.** `requireEnv` falls back to reading
`.env` itself, so on a machine that has one, no test can prove what happens
when a variable is *unset* — only when it is wrong. The invalid-value cases
cover the same branch.
