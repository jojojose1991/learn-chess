# CI and deployment to Cloud Run

The design for ticket 16. Two GitHub Actions workflows, a runnable container,
and the GCP and Infisical wiring behind them.

Decisions with real trade-offs are recorded separately:
[ADR-0006](../../adr/0006-srvx-serves-the-build-not-nitro.md) covers why the
image runs srvx rather than Nitro.

## What must become true

Ticket 16's acceptance criteria, unchanged. The ones this design has to answer
for directly:

- the image builds and serves the app on a public Cloud Run URL, with ≥1 GiB
- the native ONNX and Stockfish binaries are present **in the deployed image**
- migrations run before the revision takes traffic, over the unpooled URL,
  never at boot, and two concurrent instances cannot both run the same DDL
- secrets are passed at deploy time, never as build args
- container logs reach Cloud Logging at the severity the line was written at
- `pnpm typecheck` and `pnpm lint` pass in CI

## The container

`vite build` emits `dist/client/` and `dist/server/server.js`, the latter a
`{ fetch }` default export. `srvx serve --prod` serves it.

**The runtime stage needs `node_modules`.** This is not a preference: the built
server keeps `onnxruntime-node` as a bare external and resolves the classifier
model through `createRequire(import.meta.url).resolve(...)` at call time. Both
are runtime `node_modules` lookups relative to the running file, so `dist/`
alone is not deployable. This closes the tracked debt that says the runtime
image "carries neither the pruned `node_modules` nor the classifier's `.onnx`".

Measured sizes, and what happens to each:

| Item | Size | Disposition |
| --- | --- | --- |
| full `node_modules` | 1.0 GB | `pnpm deploy --prod --filter=.` into its own tree |
| `onnxruntime-node` darwin + win32 | 216 MB | deleted — cannot load in this image |
| `onnxruntime-node` linux/x64 | 67 MB | kept — the Scan route needs it |
| `onnxruntime-web` | 136 MB | deleted — ADR-0003 rejected the wasm path |
| `@scoriiu/fenshot` model | 1.2 MB | kept — resolved at call time |
| Stockfish 18 avx2 | ~113 MB | kept, from the pinned tarball |

`onnxruntime-web` is an auto-installed peer of `@scoriiu/fenshot`. The tracker
records that neither `packageExtensions` nor `peerDependencyRules` moves it and
only repo-wide `autoInstallPeers: false` does. Deleting it from the runtime
layer is the cheap half of that debt; the install-time half stays owed.

**The prune runs after `pnpm deploy`, not before.** `deploy` re-resolves every
dependency out of the store, so anything deleted first is faithfully restored
into the tree that ships. Measured on the real build: 866 MB after the deploy,
490 MB after the prune. `--filter=.` is required — `pnpm-workspace.yaml` has
`packages: []`, and without it pnpm selects nothing and fails with
`ERR_PNPM_NOTHING_TO_DEPLOY`.

`CMD` runs srvx with an **absolute** `--static` path — see ADR-0006 for the
silent-404 trap that motivates it.

Memory stays at `--memory 1Gi`: Stockfish 18 peaks at 377 MiB resident before
Node's own, so the 512 MiB default is an OOM kill on the first search.

## `ci.yml` — correctness before merge

Triggers on pull requests and on pushes to `main`. **It needs no secrets**:
the unit suite is pure functions and jsdom, and the e2e suite provisions its
own database. Nothing here authenticates to anything, so a workflow change
cannot leak a credential and a fork's PR runs the full suite safely.

Two jobs, in parallel:

**`check`** — `pnpm typecheck`, `pnpm lint`, `pnpm check` (Prettier, reporting
only), then `pnpm test`. Roughly two minutes.

**`e2e`** — a `postgres:18-alpine` service container published on host port
5433, so `E2E_DATABASE_URL` reads the same in CI as it does locally. Service
containers mount no volume and are destroyed with the job, so the PGDATA move
in postgres 18 that `docker-compose.yml` works around cannot bite here.
Stockfish is installed from the same pinned tarball the image uses.

**Installing Stockfish in CI is load-bearing, not incidental.** Both
`tests/lib/engine/service.test.ts` (`it.skipIf(!stockfish)`) and
`tests/e2e/engine.spec.ts` (`test.skip`) skip themselves when `STOCKFISH_PATH`
is unset. The tracker names the trigger for that debt as "a suite runs where
the binary is (16)". This is that suite.

Playwright browsers are **not** cached: Playwright's own CI documentation says
restore time is comparable to download time, and the Linux system libraries
`--with-deps` installs are not cacheable anyway. pnpm's store is cached through
`actions/setup-node`'s `cache: pnpm`, which requires `pnpm/action-setup` to run
first — `cache: pnpm` shells out to `pnpm store path`.

## `deploy.yml` — main to production

Triggers on push to `main`, gated on `ci.yml` passing. `concurrency` with no
`cancel-in-progress` serialises runs, which is what keeps two migrations off
the database at once.

1. **Authenticate to GCP** through Workload Identity Federation. No JSON key
   exists anywhere.
2. **Pull secrets from Infisical** with `Infisical/secrets-action`, pinned to
   an exact patch tag — the action publishes no floating `v1`. Values are
   exported to `GITHUB_ENV` and masked in logs by the action itself.
3. **Build and push** to Artifact Registry, tagged with the commit SHA and
   `latest`.
4. **Migrate**, over `DATABASE_URL_UNPOOLED`, after the push and before the
   deploy. Drizzle's migrator takes no advisory lock, so the protection is that
   exactly one workflow run does this at a time and the new revision does not
   exist yet.
5. **Deploy** to Cloud Run with `--memory 1Gi`, `--min-instances 0`,
   `--max-instances 3`, `--allow-unauthenticated`, and the secrets as env vars.

`BETTER_AUTH_URL` must equal the service's own public URL or the session cookie
is set for the wrong origin. It is stored in Infisical rather than derived,
because the deploy that first creates the service does not yet know the URL.

## GCP

Everything lands in `pixel-pick-487011`, which already runs pic-organizer and
has `run`, `artifactregistry`, `iamcredentials` and `secretmanager` enabled.

The existing `github-pool` carries one provider, pinned to
`assertion.repository=='picsy-pixel-pick/pic-organizer'`. That repo and this
one sit under different owners, so no owner-wide condition covers both. This
design adds a **second provider** beside it rather than widening the first,
leaving pic-organizer's binding untouched.

| Resource | Value |
| --- | --- |
| WIF provider | `github-provider-learn-chess`, pinned to `jojojose1991/learn-chess` |
| Deploy SA | `learn-chess-deploy@pixel-pick-487011.iam.gserviceaccount.com` |
| Roles | `run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser`, `secretmanager.secretAccessor` |
| Artifact Registry | `learn-chess`, Docker, `asia-southeast1` |
| Cloud Run service | `learn-chess`, `asia-southeast1` |
| Runtime identity | the default compute SA |

**The region is Singapore, not Mumbai.** Neon runs this project's database in
`ap-southeast-1`, and a Cloud Run service in `asia-south1` would pay roughly
60–80 ms per query across every request that touches the database. pic-organizer
is in Mumbai; this service is deliberately not.

A dedicated deploy service account, rather than reusing pic-organizer's, keeps
one public repository's workflow from reaching the other's infrastructure.

## Infisical

Universal Auth against Infisical Cloud, project `learn-chess-gh-6j`,
environment `prod`. `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET` are
GitHub repository secrets; the machine identity is scoped to this project and
needs only read.

Secrets to hold: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, `LOG_LEVEL`.

`STOCKFISH_PATH` and `ENGINE_MOVETIME_MS` are **not** secrets and stay `ENV`
lines in the Dockerfile: they are properties of the image, not of a deployment.

## Logging

`src/lib/log.ts` already emits `{"severity","message"}` when
`NODE_ENV=production`, which is the whole Cloud Logging integration. The
runtime stage sets `NODE_ENV=production`; `LOG_LEVEL` comes from Infisical.

## What this leaves owed

- The Scan route's memory ceiling under concurrent requests (ticket 23's
  neighbour) is still unbounded; the container's memory becomes real here but
  nothing in this design caps it.
- `onnxruntime-web` is still installed at develop time and only deleted from
  the runtime layer.
- Deployed-URL verification of the seven screens at three widths is a manual
  criterion on ticket 16, not something either workflow asserts.

## Testing

The workflows themselves are YAML and cannot be unit-tested honestly. What can:

- `scripts/` changes keep their existing tests in `tests/scripts/`.
- The container is proven by building it and running the engine and a request
  against it, which is a criterion on the ticket rather than a suite entry.
- Everything else is the existing suite, which CI runs — the point of the
  design is that the suite runs somewhere the binaries exist, not that the
  design adds assertions of its own.

A workflow that lints and tests is proven by its first red run on a branch that
deserves to be red. That is the evidence to capture in the commit.
