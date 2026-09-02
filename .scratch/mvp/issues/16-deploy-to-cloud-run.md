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

**Status:** ready-for-agent

- [ ] The image builds and the service serves the app on a public Cloud Run URL
- [ ] The service has ≥1 GiB of memory, not the 512 MiB default
- [ ] Signing in, playing a Puzzle, an engine move and a Scan all work against the deployed service
- [ ] The native ONNX and Stockfish binaries are present at runtime, verified in the deployed image and not just locally
- [ ] Migrations run as a CI step or Job before the revision takes traffic, over the unpooled URL, and never at boot
- [ ] Two concurrent instances of a new revision cannot both run the same DDL
- [ ] Secrets are passed at deploy time, never as build args, and no non-`VITE_` value is read at module scope
- [ ] A Puzzle Link opened on a phone with no session lands on Play
- [ ] `pnpm typecheck` and `pnpm lint` pass in CI
