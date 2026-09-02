# Docker on Cloud Run, Neon, auth, and the two compute jobs

Everything here was read from shipped source, measured in a container, or is
flagged as unverified. Several items contradict the official docs.

## TanStack Start → a Node server in Docker

**Nitro is opt-in but still required for the Node target.** Start no longer
bundles it — `@tanstack/start-plugin-core` now depends on `srvx ^0.11.9` plus
`@tanstack/start-server-core`, which uses `h3@2.0.1-rc.20`. But srvx is *what
Nitro's node preset runs on underneath*, not an alternative Node target for the
Vite build; the docs only offer standalone srvx for the **rsbuild** output. The
official hosting guide for Vite says: *"Follow the Nitro deployment
instructions. Use the `node` command to start your application from the server
from the build output files."*

⚠️ **`nitro` has no stable release.** npm `latest` is `3.0.260610-beta`
(2026-06-10) — every published version is a date-stamped beta, and the docs carry
an explicit "under active development" warning. The package was renamed from
`nitropack` to `nitro`. Fallback is `@tanstack/nitro-v2-vite-plugin@1.155.0`
(wraps `nitropack ^2.13.1`), but it was last published 2026-05-15 against
react-start 1.168.49 — about 3.5 months stale. **Two pre-GA dependencies sit on
the deployment path** (Start itself is RC).

Config, matching the official `examples/react/start-basic`:

```ts
// vite.config.ts
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tanstackStart(), viteReact(), nitro()],
})
```

No preset needed — Nitro's production default **is** `node_server`.
`nitro({ preset: 'node-server' })` is explicit and harmless.

**Output:** `.output/server/index.mjs` (entry) and `.output/public/` (client
assets, served by the same server). Scripts are `"build": "vite build"` and
`"start": "node .output/server/index.mjs"`. The output is **self-contained** —
Nitro bundles dependencies in, so the runtime stage needs no `node_modules`.

**`PORT` works with zero configuration.** Nitro's node preset reads
`NITRO_PORT || PORT` (default 3000) and `NITRO_HOST || HOST` (default
`0.0.0.0`). Cloud Run injects `PORT` (default 8080) and requires binding
`0.0.0.0` — both satisfied.

```dockerfile
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable pnpm
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
USER node
CMD ["node", ".output/server/index.mjs"]
```

No `EXPOSE`, no `--port`, no `node_modules` in the runtime stage.

⚠️ **The one thing that must be tested early.** Nitro bundles most deps into
`.output/server`, but **native modules it cannot bundle get externalised into
`.output/server/node_modules/`**. With `onnxruntime-node` (and anything native
for the engine) a runtime stage copying only `.output` may be missing the
`.so`/`.node` files. Nitro's **`traceDeps`** is the knob; `noExternals` and
`output.dir` are the neighbours ([nitro config](https://nitro.build/config)).

**`corepack enable` works on Node 24 (experimental) but Corepack is removed from
the Node distribution in 25+.** On 25+ use `npm i -g pnpm@11` or the
`ghcr.io/pnpm/pnpm:11` base image. pnpm's `latest` is **11.25.0**.
[pnpm's Docker page](https://pnpm.io/docker) recommends BuildKit cache mounts on
`/pnpm/store`, or `pnpm fetch --prod` where cache mounts aren't available.

**Env vars in a Docker build:** only `VITE_`-prefixed values are inlined into the
client bundle, and they are **permanently baked into the image layer**. Server
vars are read from `process.env` at runtime, and the docs say to *read env
per-request, not at module scope*. Pass secrets at deploy time, never as build
args.

**There is no official Cloud Run guide.** The Start docs' Node/Docker section is
three lines with no Dockerfile, and the Dockerfile in
`docs/router/how-to/deploy-to-production.md` is for a static SPA behind nginx —
not applicable. Third-party: [Railway's guide](https://docs.railway.com/guides/tanstack-start),
[olegkorol/docker-tanstack-start](https://github.com/olegkorol/docker-tanstack-start/blob/main/Dockerfile).

## Neon from Cloud Run

**Use the pooled connection string with plain `pg` and
`drizzle-orm/node-postgres`. Do not use `@neondatabase/serverless` here.**

Drizzle's own Neon page says it outright:

> "To use Neon from a serverful environment, you can use the node-postgres or
> Postgres.js drivers, as described in Neon's official Node.js docs"

The serverless driver exists to work around edge runtimes having no raw TCP
sockets. Cloud Run is a normal long-lived Node process with full TCP, so it buys
nothing and costs a `ws` dependency plus a WebSocket proxy hop.

⚠️ No Neon doc says "don't use the serverless driver on a long-lived server" in
those words — Neon's page is neutral (HTTP for "one-shot queries", WebSocket
`Pool`/`Client` for sessions and interactive transactions). The affirmative
recommendation is Drizzle's.

| Driver | Drizzle adapter | Notes |
|---|---|---|
| `neon()` HTTP fetch | `drizzle-orm/neon-http` | "single, non-interactive transactions" ⚠️ not verified at source whether `db.transaction()` throws |
| `Pool` from `@neondatabase/serverless` (WS) | `drizzle-orm/neon-serverless` | needs `ws` in Node |
| **`pg.Pool`** | **`drizzle-orm/node-postgres`** | **← our case** |
| `postgres.js` | `drizzle-orm/postgres-js` | also fine |

**Two URLs are needed.** Neon documents the pooled endpoint for connection-churn
workloads, but **direct (unpooled) connections for schema migrations**,
`pg_dump`, logical replication, and anything needing `SET`, `LISTEN/NOTIFY` or
session state ([connection-pooling](https://neon.com/docs/connect/connection-pooling)).
So `DATABASE_URL` is pooled for the app and `DATABASE_URL_UNPOOLED` is direct
for `drizzle-kit`.

**Pool sizing.** Neon's pooler (PgBouncer) allows `max_client_conn` up to
**10,000** concurrent clients, but concurrent *active transactions* per user per
database cap at ~90% of the compute's `max_connections`: 0.25 CU → 104,
1 CU → 419, 2 CU → 839, 8 CU → 3,357, 9+ CU → capped at 4,000. Budget
`max_instances × pool.max` against that. `pg`'s `Pool` defaults to `max: 10` and
Cloud Run's default `--concurrency` is 80 per instance.

For this app: **`max: 5`, `idleTimeoutMillis: 30_000`,
`connectionTimeoutMillis: 10_000`, and an `error` listener on the pool** — an
idle client erroring with no listener crashes the process. The pool is a queue,
not a throughput cap; a fat pool on a scale-to-many service is how you exhaust
the compute's transaction budget.

**Cloud Run CPU throttling interacts with this.** Under default request-based
billing, *"CPU is allocated when instances are processing requests"*; CPU outside
requests needs min-instances **and** instance-based billing
(`--no-cpu-throttling`) ([container contract](https://docs.cloud.google.com/run/docs/container-contract)).
⚠️ Inference, not a documented chain: a frozen instance cannot run pool keepalive
timers, so pooled connections may be dropped underneath you between requests —
another argument for a small pool, a short idle timeout, and tolerating a
reconnect rather than a big warm pool.

**Neon scale-to-zero** defaults to **5 minutes** of inactivity, resuming *"within
a few hundred milliseconds"*, available only for computes ≤16 CU, and the free
plan cannot disable it ([scale-to-zero](https://neon.com/docs/introduction/scale-to-zero)).
The first query after idle eats a few hundred ms. **Cloud Run's `--min-instances`
does nothing for this** — it keeps our container warm, not Neon's compute. One
retry on connection-level errors covers it.

## Drizzle migrations

**`drizzle-orm` 1.0 is NOT released.** Stable `latest` is **0.45.2**
(2026-03-27); `rc` is 1.0.0-rc.4 (2026-06-27) and all 1.0 GitHub releases are
marked prerelease. `drizzle-kit` latest is **0.31.10**. Confusingly,
orm.drizzle.team **already documents the RC** (`drizzle-orm@rc`), so current docs
do not match current stable. Pin 0.45.2 + 0.31.10.

**The migrator takes no advisory lock — verified in shipped source, not
inferred.** `drizzle-orm@0.45.2`, `node-postgres/migrator.cjs` →
`db.dialect.migrate()` in `pg-core/dialect.cjs` lines 46–74. The whole algorithm:

1. `CREATE SCHEMA IF NOT EXISTS drizzle` / `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations`
2. `select ... order by created_at desc limit 1` — read the last applied migration
3. Open **one** transaction and apply every migration newer than that

Grepping `advisory|pg_advisory|LOCK TABLE` across the migrator and dialect finds
**nothing**. Step 2 is read-then-write with no mutual exclusion, so two Cloud Run
instances starting on the same new revision both read the same watermark and both
run the same DDL. One transaction wins; the container that lost is now
crash-looping at boot. **Cloud Run starts multiple instances of a new revision
concurrently by default, so this is not a rare race.**

Correct shape:

- `drizzle-kit generate` locally; commit the SQL in `./drizzle`.
- `drizzle-kit migrate` as a **CI/CD step or a
  [Cloud Run Job](https://docs.cloud.google.com/run/docs/create-jobs)** that runs
  to completion *before* the new revision takes traffic, against the **unpooled**
  endpoint.
- If migrating at boot is unavoidable: wrap `migrate()` in your own
  `select pg_advisory_lock($1)` / `pg_advisory_unlock($1)` on a fixed key, or
  deploy the migrating revision with `--max-instances 1` first. Both are more
  moving parts than a separate job.

`drizzle-kit@0.31.10` verbs: `generate`, `migrate`, `push`, `pull`, `check`,
`up`, `studio`, `export`. **`push` skips migration files entirely** —
prototyping only, never a deploy step.

```ts
// drizzle.config.ts — current shape
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! },
})
```

⚠️ `driver: 'pg'` with `dbCredentials.connectionString` still appears in some of
Drizzle's own older docs pages. That is the **pre-0.21** shape. Current is
`dialect` + `dbCredentials.url`.

## BetterAuth

**`better-auth@1.7.2`** (2026-08-26) declares `@tanstack/react-start: ^1.0.0` as
a peer and its exports map includes **`./tanstack-start`** and
`./tanstack-start/solid`. Docs:
[better-auth.com/docs/integrations/tanstack](https://www.better-auth.com/docs/integrations/tanstack).

Handler mounts at `src/routes/api/auth/$.ts`:

```ts
export const Route = createFileRoute('/api/auth/$')({
  server: { handlers: {
    GET:  async ({ request }) => auth.handler(request),
    POST: async ({ request }) => auth.handler(request),
  }},
})
```

Cross-checked against Start's current server-routes guide — this is today's API.
`createServerFileRoute` is gone from the Start docs. One `ANY` handler works too
and is what we ship: BetterAuth's `handler` dispatches on the method itself, so
splitting `GET`/`POST` only duplicates the same one-liner.

- **`reactStartCookies` is gone** from 1.7.2 (zero occurrences in `dist/`). The
  current plugin is **`tanstackStartCookies()`** from `better-auth/tanstack-start`,
  whose own JSDoc says: *"TanStack Start cookie plugin for React… It uses
  `@tanstack/react-start-server` to set cookies."* ⚠️ The "must be last in
  `plugins`" rule is BetterAuth's general convention for cookie plugins and was
  **not** verified for this one specifically.
- Client is plain `createAuthClient` from `better-auth/react` — nothing
  TanStack-specific. Session helpers use **`getRequestHeaders`** (plural) from
  `@tanstack/react-start/server`.
- **Drizzle adapter:** use the standalone **`@better-auth/drizzle-adapter@1.7.2`**
  (`drizzleAdapter(db, { provider: "pg" })`). The subpath
  `better-auth/adapters/drizzle` also resolves and BetterAuth's own docs are
  internally inconsistent about which to use — prefer the dedicated package.
  Set **`advanced: { database: { joins: true } }`** for a documented 2–3×
  `/get-session` improvement.
- Tables: `user`, `session`, `account`, `verification`.
- **The CLI is the npm package `auth`** (1.7.2, bins `auth` and `better-auth`):
  `npx auth@latest generate --adapter drizzle --dialect postgresql` →
  `drizzle-kit generate` → `drizzle-kit migrate`. **`@better-auth/cli` is stale
  at 1.4.21** and still pins `drizzle-orm ^0.41` — do not use it.
- Plugins confirmed present: `./plugins/anonymous`, `magic-link`,
  `one-time-token`, `email-otp`, `jwt`.
- **A public share link needs no BetterAuth involvement at all.** The `anonymous`
  plugin creates a real user row and a session, which is more state than an
  unguessable token in a URL checked against our own table.
- All historically-cited BetterAuth × TanStack Start issues are closed (#7064,
  #8059, #6341, #4328). Of the open "tanstack" issues, only
  [#10077](https://github.com/better-auth/better-auth/issues/10077) (TypeScript
  OOM inferring `createAuthClient` plugin types with many client plugins) could
  plausibly bite.
- ⚠️ Not verified: the exact `emailAndPassword` / `sendResetPassword` signatures,
  and the CLI's `generate` output for Drizzle.

## Resend

**`resend@6.25.0`** (2026-08-28). Hooks take `({ user, url, token }, request)`:

```ts
emailAndPassword: { enabled: true, sendResetPassword: async ({ user, url }) => { /* … */ } },
emailVerification: { sendVerificationEmail: async ({ user, url }) => { /* … */ } },
```

- The docs explicitly warn **do not `await` the send** (timing attacks) — `void`
  it, or `waitUntil` on serverless.
- The official example at [resend.com/better-auth](https://resend.com/better-auth)
  uses **plain HTML strings**; `@react-email/components` is not required.
- Free tier: **100/day, 3,000/month, 3 domains**, no overage charges.
- **`onboarding@resend.dev` is sandbox-only** and 403s when sending anywhere but
  the account owner — a **verified domain is required** for real password-reset
  mail. This is why reset is cut from the MVP.
- Set `BETTER_AUTH_URL` or reset links point at the wrong origin.

## Native Stockfish in the container

Measurements below ran in real `linux/amd64` containers.

**Version:** Stockfish **18** is current stable, tag `sf_18`, released
**2026-01-31**.

**Which binary:** `stockfish-ubuntu-x86-64-avx2`. Cloud Run's contract states
that *"All CPU platforms used by Cloud Run support the AVX2 instruction set"* and
that executables must be Linux x86_64. Nothing above AVX2 is guaranteed — there
is a [third-party report](https://haitmg.pl/blog/cloud-run-sigill-avx512-llama-cpp/)
of Sapphire Rapids regions advertising AVX-512 in CPUID but disabling it at the
hypervisor, causing SIGILL (anecdote, not a Google source).

**NNUE nets are embedded — nothing ships separately.** `src/nnue/network.cpp`
uses `incbin` to compile both nets in: big net `nn-c288c895ea92.nnue` 69.4 MiB,
small net `nn-37f18f62d772.nnue` 2.74 MiB. Verified: the binary starts and
returns `bestmove` in a container with zero `.nnue` files on disk. Overridable
via the `EvalFile` / `EvalFileSmall` UCI options.

**Size (measured):** release tar 114.4 MB; the binary itself **112.9 MB**,
already stripped, of which `.rodata` is 112.5 MB and `.text` only 298 KB.
`gzip -9` → 75.9 MB, so budget **~72 MiB of Docker layer**.

**Install from the official tarball, not apt.** Debian trixie ships `17-1`,
bookworm `15.1-4`, Ubuntu noble `16-1build1`. Worse than the version lag:
`echo compiler | stockfish` on the Debian build reports
`Compilation settings: 64bit SSE2` — **the generic SSE2 baseline, no AVX2, no
POPCNT.** NNUE evaluation is exactly where a 200 ms budget is spent. ⚠️ The
SSE2-vs-AVX2 delta was not benchmarked; upstream only says a mismatched build
"can make the engine much slower".

```dockerfile
FROM debian:bookworm-slim AS sf
ADD https://github.com/official-stockfish/Stockfish/releases/download/sf_18/stockfish-ubuntu-x86-64-avx2.tar /tmp/sf.tar
RUN tar -xf /tmp/sf.tar -C /tmp && mv /tmp/stockfish/stockfish-ubuntu-x86-64-avx2 /usr/local/bin/stockfish
```

Verified: the Ubuntu-built binary runs fine on Debian bookworm glibc 2.36. **It
does not run on Alpine/musl** — silent no-output failure.

**Skip every npm UCI wrapper.** `node-uci` is the popular one and it is
**abandoned, last published 2020-04-24**, with four runtime deps (`bluebird`,
`core-js`, `debug`, `lodash`). `uci`, `node-stockfish` and `chess-uci` are
dormant; `easy-uci` does not exist on npm. The only maintained native wrapper is
`@echecs/uci@4.1.0` (pushed 2026-09-01) at 2 stars. **The npm `stockfish@18.0.8`
package is WASM, not native.**

The entire protocol surface is `uci`→`uciok`, `setoption`, `isready`→`readyok`,
`position …`, `go movetime 200`→`bestmove`. That is `child_process.spawn` plus
`readline.createInterface` and a promise resolving on the `bestmove` line —
**~30 lines, no deps**, and you own the timeout and restart behaviour that
actually bites in production.

**Memory (measured, `Threads=1`, repeated `go movetime 200`).** Defaults are
`Hash` 16 MB, `Threads` 1.

| | Hash | VmRSS | Peak VmHWM |
|---|---|---|---|
| SF 18 avx2 | 16 | 298 MiB | **377 MiB** |
| SF 18 avx2 | 32 | 330 MiB | 377 MiB |
| SF 17.1 (Debian) | 16 | 256 MiB | 256 MiB |

Container-level `memory.current` delta is much kinder — 1 engine **186 MiB**,
2 engines 241 MiB, 3 engines 296 MiB, i.e. **~55 MiB per extra engine**. SF 18 is
new-in-18 shared-memory-backed (`src/shm.h`), so processes share the net weights;
no UCI option was found to disable that.

**512 MiB is not safe.** The 377 MiB startup peak alone is 74% of it before
Node's ~40–70 MiB, and Cloud Run OOM-kills the whole instance. **Use
`--memory 1Gi`.** (Cloud Run's default is 512 MiB; 1 vCPU allows up to 4 GiB.)

Startup measured at **~490 ms** spawn→`readyok`; steady-state `go movetime 200`
round-trips at exactly 200 ms. **Keep the process warm; do not spawn per
request.** ⚠️ All measurements ran under `--platform linux/amd64` emulation on
Apple Silicon; memory was cross-checked at ~3 MiB overhead, but the 490 ms
startup is the figure most likely inflated.

### GPL-3.0 — what the sources actually say

Not legal advice. This is the reasoning behind
[ADR-0003](../adr/0003-server-side-compute.md).

- Stockfish is **GPL-3.0-or-later, not AGPL**. Its README: *"whenever you
  **distribute** Stockfish in some way, you MUST always include the license and
  the full source code (or a pointer to where the source code can be found) to
  generate the exact binary you are distributing."*
- **Hosting server-side is not distribution.** GPLv3 §0: *"Mere interaction with
  a user through a computer network, with no transfer of a copy, is not
  conveying."* FSF FAQ
  [#NoDistributionRequirements](https://www.gnu.org/licenses/gpl-faq.html#NoDistributionRequirements):
  running without distributing → *"Nothing. The GPL does not place any conditions
  on this activity."*
  [#UnreleasedMods](https://www.gnu.org/licenses/gpl-faq.html#UnreleasedMods)
  adds: *"The situation is different when the modified program is licensed under
  the terms of the GNU Affero GPL."*
- **Shipping stockfish.wasm to browsers IS distribution, and the FSF names this
  case.** Same answer: a site distributing GPLed programs to the visitor, *"often
  written in JavaScript"* — *"the source code for the programs being distributed
  must be released to the user under the terms of the GPL."* That triggers GPLv3
  §6(d) (equivalent access to Corresponding Source in the same place, with clear
  directions next to the object code) plus §4 and §5. It is why npm `stockfish`
  ships `Copying.txt` beside the `.wasm`.
- **A separate process over a pipe is the safe side of the line.** FSF FAQ
  [#MereAggregation](https://www.gnu.org/licenses/gpl-faq.html#MereAggregation):
  *"pipes, sockets and command-line arguments are communication mechanisms
  normally used between two separate programs. So when they are used for
  communication, the modules normally are separate programs."* Same-executable or
  shared-address-space linking is *"definitely combined in one program"*. UCI
  over stdio is line-oriented text, on the separate-programs side of both prongs.
  The FSF itself calls this *"a legal question, which ultimately judges will
  decide."*
- **They enforce.** The [lawsuit against ChessBase](https://stockfishchess.org/blog/2021/our-lawsuit-against-chessbase/)
  permanently terminated their GPL licence; earlier enforcement forced a Fat
  Fritz 2 DVD recall and ended Houdini 6 sales. The
  [2022 settlement](https://stockfishchess.org/blog/2022/chessbase-stockfish-agreement/)
  required a Free Software Compliance Officer and credit for Stockfish. **Every
  case turned on distribution plus concealed origin, not on hosting.**
- ⚠️ **Unverified:** no statement from the Stockfish team addressing hosted/SaaS
  server-side use. The conclusion rests on the GPLv3 text and the FSF FAQ only.

## `onnxruntime-node` in the container

**Debian, not Alpine.** npm ships prebuilts for `os: ["win32","darwin","linux"]`,
**glibc only — there is no musl build**. On Alpine you hit the standard
`Error loading shared library libonnxruntime…` / missing `libstdc++.so.6`,
`libgcc_s.so.1` chain
([microsoft/onnxruntime#17986](https://github.com/microsoft/onnxruntime/issues/17986));
`apk add libc6-compat` is the usual band-aid and is not reliable here. Use
`node:24-slim` or `node:22-slim`.

⚠️ Not verified empirically whether slim needs `libgomp1` added — worth a
one-line test, since OpenMP is the usual missing piece on slim images.

**Node version:** **24.20.0 is Active LTS (Krypton)**; 22.23.2 (Jod) is in
maintenance. Both work (README: Node 16+, recommend 20+). Image sizes:
`node:24-slim` 80.7 MB compressed, `node:24-alpine` 58.5 MB, `node:24` 409.6 MB.

**Image size is the real story.** `onnxruntime-node@1.29.0`: tarball
**111.7 MB**, **unpacked 296.3 MB** — because it bundles prebuilts for *every*
platform (linux x64 + arm64, darwin arm64, win32 x64 + arm64, including DirectML
and dxcompiler DLLs). linux/x64 actually needs only `libonnxruntime.so.1`
(44.7 MB) plus `onnxruntime_binding.node` (389 KB) ≈ **43 MB**. Prune
`node_modules/onnxruntime-node/bin/napi-v6/{win32,darwin}` in the build stage.

**The postinstall is worse than you'd expect.** `package.json` has
`"postinstall": "node ./script/install"`, and `script/install-metadata.js`
declares `requirements: { 'linux/x64': ['cuda12'] }` — the manifest pulls
`libonnxruntime_providers_cuda.so`, `libonnxruntime_providers_shared.so` and
`libonnxruntime_providers_tensorrt.so` **from nuget.org at install time**. The
README confirms: *"By default, the CUDA EP binaries are installed automatically
when you install the package."* So a plain `pnpm install` on linux/x64 wants
network egress to NuGet and downloads hundreds of MB of GPU providers this
service will never use.

```dockerfile
ENV ONNXRUNTIME_NODE_INSTALL=skip
```

(or `--onnxruntime-node-install=skip` on the install command). The CPU
`libonnxruntime.so.1` is bundled in the tarball, so CPU inference works with the
postinstall fully skipped.

**pnpm:** pnpm 10+ blocks lifecycle scripts by default, so you would normally add
`onnxruntime-node` to `pnpm.onlyBuiltDependencies` / `allowBuilds`. **Don't** —
for CPU-only we want that script *not* to run. Leave it blocked, or set the skip
env var, and the build is smaller, network-free and reproducible.

⚠️ Verified the script exists and what it downloads; did **not** run
`pnpm install` end-to-end to confirm the blocked-script path leaves a working
CPU install.

**Why not run `onnxruntime-web`'s wasm in Node instead?** It does work there —
ORT's docs describe onnxruntime-web as *"a Javascript library for running ONNX
models on browsers and on Node.js"* — but the same docs then say *"To use Node.js
as the server application, use onnxruntime-node… on the server"*. Size is no
escape: `onnxruntime-web@1.29.0` unpacks to **142.0 MB** across 509 files, with
`ort-wasm-simd-threaded.wasm` at 14.0 MB (jsep 27.8 MB, asyncify 25.7 MB). You
would need `ort.env.wasm.wasmPaths` pointed at a local path, and threads need
SharedArrayBuffer. The native `.so` is a ~43 MB mmap at startup; the wasm path
pays a JIT compile on **every cold start**, which is the wrong trade on a
scale-to-zero service. ⚠️ No benchmark numbers found for either, wasm or native
CPU, on a small model.
