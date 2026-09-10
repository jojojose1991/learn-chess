# 16 — Deploy to Cloud Run

**What to build:** The whole thing running in production, on a URL a Coach can
open and a Student can be sent. Prod only; there is no staging.

Facts already verified against the shipped packages: Nitro is still required
for the Node server target and is no longer bundled by default, so `nitro()`
from `nitro/vite` joins the plugin array after `tanstackStart()` and
`viteReact()`. Its production preset is already `node_server`, and it reads
`NITRO_PORT || PORT` and binds `0.0.0.0`, which is exactly Cloud Run's
contract. Build output is a self-contained `.output/`, so the runtime image
needs no `node_modules` — but Nitro externalises what it cannot bundle into
`.output/server/node_modules/`, so a stage copying only `.output` can be
missing a native `.so`. `traceDeps` is the knob.

Migrations run as a CI step or a Cloud Run Job before a revision takes traffic,
never at boot: Drizzle's migrator has no advisory lock and Cloud Run starts
instances of a new revision concurrently, so both would run the same DDL and
the loser crash-loops.

**Blocked by:** 13 (engine defends) and 15 (four-corner warp).

**Status:** resolved

- [x] The image builds and the service serves the app on a public Cloud Run URL
- [ ] The service has ≥1 GiB of memory, not the 512 MiB default
- [x] Signing in, playing a Puzzle, an engine move and a Scan all work against the deployed service
- [x] The native ONNX and Stockfish binaries are present at runtime, verified in the deployed image and not just locally
- [x] Migrations run as a CI step or Job before the revision takes traffic, over the unpooled URL, and never at boot
- [x] Two concurrent instances of a new revision cannot both run the same DDL
- [x] Secrets are passed at deploy time, never as build args, and no non-`VITE_` value is read at module scope
- [x] A Puzzle Link opened on a phone with no session lands on Play
- [x] Every screen is used on the deployed URL at 390px, 820px and 1280px, and none needs sideways scrolling
- [ ] Container logs reach Cloud Logging with the severity the line was written at, and `LOG_LEVEL` is set on the service
- [x] The `/credits` notice page is live on the deployed service, and `/pieces/LICENSE.txt` is served
- [x] `pnpm typecheck` and `pnpm lint` pass in CI

## Comments

`/pieces/LICENSE` 404'd on the first deployed revision: srvx's static handler
maps an extensionless request to `<path>.html` and `<path>/index.html` and
never the file itself, so the licence pointer on `/credits` did not resolve
while every `.svg` beside it served. The file is now `LICENSE.txt`, which
reverses ticket 06's declined rename — the decline assumed the file was
reachable, and ADR-0004 records the changed premise.

That criterion is now ticked: the revision carrying the rename is out, and
`/pieces/LICENSE.txt` answers 200 `text/plain` on the deployed service.

Ten criteria were walked against the live service on 2026-09-10, signed in as
the seed Coach with Playwright driving Chromium at the deployed URL:

- **The classifier runs in the container.** A Scan of `tests/fixtures/board-white.png`
  through the New Puzzle file input read the position exactly, so
  `onnxruntime-node`'s native library shipped. Nothing below this proves it —
  `/api/scan` answers 401 before the session is loaded, so an unauthenticated
  probe cannot tell a present binary from a missing one.
- **The Play loop closes over the network.** A pawn push accepted in the
  browser, then "Not this time" with the defender's reply listed beside it —
  Stockfish reached from the client, not just from `curl`.
- **Seven screens at 390, 820 and 1280**, sign-in, Library, New Puzzle,
  Accounts, Credits, Confirm & Edit and Play: 21 of 21 with no sideways
  scrolling, and a Student's Play at 390px too.
- **A Puzzle Link with no session** lands straight on Play in a fresh context,
  with no Library link and nothing to sign into.
- The engine's error shapes hold on the wire: 422 for an illegal Position,
  401 rather than 500 for a wrong password, 404 for an unknown slug.

Two criteria stay unticked, and both need `gcloud`, which is not installed on
this machine — neither is observable over HTTP:

- the service's memory, which `.github/workflows/deploy.yml` sets to `1Gi` but
  nothing here reads back off the live revision;
- logs reaching Cloud Logging at the severity the line was written at, with
  `LOG_LEVEL` set on the service.

**Closed with those two unticked, on the Coach's call**, rather than ticked on
an inference. Both are carried forward in `docs/TRACKER.md` against ticket 23,
which cannot start without reading the deployed service's own configuration —
that is the next time `gcloud` is in hand, and it confirms the memory limit in
the same breath as the concurrency and body ceilings it exists to establish.

`gcloud run services describe` and `gcloud logging read` close both. Note that
`LOG_LEVEL` is not among the four keys the Migrate step refuses to run on when
blank, so a missing one is deployed as an empty string — harmless, because
`isLevel("")` is false and `floor()` falls back to `info` in production, but it
means the criterion needs the value read back rather than assumed.

An aside worth not tripping over: `GET /api/engine/move` answers 200 with the
app's HTML shell, since only a `POST` handler is declared and the request falls
through to the router. No engine work happens, but this is the shape AGENTS.md
warns about, so never assert a 404 there.
