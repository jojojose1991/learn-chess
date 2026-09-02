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

**Status:** ready-for-agent

- [ ] `bestMove(fen, movetimeMs)` returns a legal move for a given Position
- [ ] One long-lived process serves many requests; a second request does not pay spawn cost
- [ ] A crashed or hung engine is detected and restarted rather than wedging the route
- [ ] A request that exceeds its budget fails cleanly instead of hanging
- [ ] The engine route validates its input Position and refuses an illegal one
- [ ] A Dockerfile builds an image with Stockfish present, from the AVX2 tarball, on a Debian-slim Node 24 base
- [ ] The engine runs inside that image with ≥1 GiB of memory available
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
