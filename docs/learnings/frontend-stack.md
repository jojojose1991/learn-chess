# TanStack Start, shadcn and Tailwind

Gathered while evaluating a migration from the original Next.js 16 scaffold. The
repo is now a `create-tanstack-app` scaffold, so most of the migration mechanics
are moot — but the compatibility facts and the provenance notes are worth
keeping.

## TanStack Start

- Package is **`@tanstack/react-start`**. `@tanstack/start` is dead (last
  published 1.120.20, 2025-06-08).
- **1.168.49** (2026-08-22). **Release Candidate, not GA.** The docs say
  verbatim: *"TanStack Start is currently in the Release Candidate stage! This
  means it is considered feature-complete and its API is considered stable."*
  v1 RC was announced 2025-09-22 and it is still labelled RC roughly a year on.
- Build tooling is **Vite 8.2.2** by default, or Rsbuild.
- Related: `@tanstack/react-router` 1.170.32, `@tanstack/cli` 0.71.0.
- `tanstackStart()` **bundles `@tanstack/router-plugin`** — do not install it
  separately; `routeTree.gen.ts` still generates.
- `resolve: { tsconfigPaths: true }` is native in Vite 8 — no
  `vite-tsconfig-paths` needed.
- Plugin order matters: the React plugin must come **after** Start's.
- **There is no `target` option on `tanstackStart()`.** Verified in source: the
  signature is `tanstackStart(options?: TanStackStartViteInputConfig & { rsc?: { enabled?: boolean } })`
  and `start-plugin-core`'s schema does `.omit({ autoCodeSplitting: true, target: true })`.
  Target is derived from the framework.
- Minimal app has **no `index.html` and no `main.tsx`** — `src/routes/__root.tsx`
  owns `<html>`/`<head>`/`<body>` plus `<HeadContent/>` and `<Scripts/>`, and
  `src/router.tsx` exports `getRouter()`.

Deployment specifics (Nitro, Docker, `PORT`, `.output/`) are in
[deployment.md](./deployment.md).

## Static output — measured, then made irrelevant

We evaluated a fully static build before deciding on a server. Recording it
because the numbers were empirically checked and the conclusions are not obvious.

Two distinct modes, and the difference matters:

| | `spa: { enabled: true }` | `prerender: { enabled: true, crawlLinks: true }` |
|---|---|---|
| Output | **`dist/client/_shell.html`** only — **no `index.html`** | real `index.html`, `about/index.html`, … |
| HTML content | empty shell | actually prerendered markup |
| Needs host rewrite | **yes**, `/* /_shell.html 200` | no, for known routes |

SPA mode landed in **1.121.0**. The `_shell.html`-not-`index.html` surprise is
fixable with `spa: { prerender: { outputPath: '/index.html' } }`. Output is
`dist/client/` (assets) plus `dist/server/server.js` (~220 KB) which you delete
for a static deploy. Prerendering runs in-process using the SSR bundle — no
headless browser. Prerendering is **the one thing plain Vite + TanStack Router
cannot do**.

**`file://` does not work, for three independent reasons:**

1. **Start emits root-absolute asset paths and cannot be made relative.**
   `base: './'` is not honoured — it emits the broken `/./assets/index-xxx.js`.
   Cause: Start uses Vite's `base` as one source of truth for both routing and
   assets ([router#4888](https://github.com/TanStack/router/issues/4888)).
   `base: '/subpath/'` **does** work correctly, including router basepath wiring.
2. **ES module scripts are CORS-blocked from `file://`** — browsers treat local
   files as opaque origins ([Vite troubleshooting](https://vite.dev/guide/troubleshooting)).
3. **`fetch()` is dead on `file://`**, which kills any `.onnx` or `.wasm` load
   regardless of 1 and 2. `crossOriginIsolated` is also false.

`vite-plugin-singlefile` 2.3.3 genuinely produces a double-clickable single
`dist/index.html` with inlined modules — but only for Start-free Vite, and it
still cannot `fetch()` a model or a wasm engine.

**Migration cost between Start and plain Vite + Router is ~5 files either way**
(delete `index.html` and `main.tsx`, move `createRouter` into a `getRouter()`
export, have `__root.tsx` render the document, swap the Vite plugin, move the CSS
link into `head`). Route files, components, loaders and search-param code are
untouched. There is no documented migration guide in either direction, but there
is also no lock-in.

## shadcn/ui — all green outside Next.js

- **Official TanStack Start support.** Decompiled from `shadcn@4.19.1`: the
  framework registry contains `"tanstack-start"` with docs at
  `/docs/installation/tanstack`, and there is a `-t start` template. Detection
  is **any dep or devDep starting `@tanstack/react-start`**, checked *before*
  `vite.config.*`. There is no `tanstack-router` framework — plain Vite + Router
  falls through to `"vite"`.
- ⚠️ **`rsc` must be `false`** for both Vite and Start targets, or newly added
  components keep their `"use client"` directives. (Our scaffold already has it.)
- **`base-nova` is portable.** The `style` field encodes a base and a style:
  `PRESET_BASES = ["radix","base","aria"]`, `PRESET_STYLES = ["nova","vega",
  "maia","lyra","mira","luma","sera","rhea"]`, so `base-nova` = Base UI + nova,
  served from `/r/styles/base-nova/*.json`. Nothing framework-aware.
  ⚠️ **This scheme is undocumented on ui.shadcn.com** — it comes from decompiling
  the shipped CLI binary. `style` is also documented as unchangeable after init.
- `@base-ui/react` **1.7.0** peers are only `react`, `react-dom`,
  `@types/react`, `date-fns` — **no `next`**. The registry's
  `dialog`/`select`/`dropdown-menu`/`sidebar` import only `@base-ui/react/*`,
  `cva` and `@/lib/utils`.
- `"use client"` in a Vite build is **harmless** — zero warnings under rolldown.

## Tailwind v4

Officially supported with its own
[integration guide](https://tanstack.com/start/latest/docs/framework/react/guide/tailwind-integration).
`tailwindcss` + `@tailwindcss/vite`, both **4.3.3**. TanStack's documented plugin
order is `[tsConfigPaths(), tanstackStart(), viteReact(), tailwindcss()]`.

Two deltas from a Next.js setup:

1. Use **`@import 'tailwindcss' source('../');`** if the CSS file is not at
   project root, or content detection misses the routes.
2. Register the stylesheet in `__root.tsx`:
   `import appCss from '../styles/app.css?url'` plus
   `head: () => ({ links: [{ rel: 'stylesheet', href: appCss }] })`.

**lightningcss dual-version is not a conflict.** `@tailwindcss/node@4.3.3` pins
lightningcss exactly 1.32.0; `@tanstack/start-plugin-core` uses `^1.32.0` →
1.33.0. Two independent transitive deps, two native binaries, no breakage. The
historical breakage ([tailwindcss#18002](https://github.com/tailwindlabs/tailwindcss/issues/18002))
closed 2025-11-18. **The only real trap is setting `css.transformer: "lightningcss"`
yourself — don't.**

## Dark mode: `next-themes` is not a Next.js dependency

Surprising enough to be worth verifying, so it was: **`next-themes@0.4.6`'s
`dist/` contains zero references to `next/`.** No dependencies at all; peers are
only `react` and `react-dom`. The name is historical — it is framework-agnostic
and ports unchanged.

Caveat: its no-flash guarantee relies on a blocking inline script, which works
under SSR/SSG but not in a pure client-only SPA. shadcn's own
[TanStack Start dark-mode doc](https://ui.shadcn.com/docs/dark-mode/tanstack-start)
is ~100 lines and handles FOUC via `ScriptOnce` from `@tanstack/react-router`;
the [Vite doc](https://ui.shadcn.com/docs/dark-mode/vite) is ~78 lines with no
FOUC mitigation.

Moot for this project — dark mode is cut (see [BACKLOG.md](../BACKLOG.md)).

## Serving large binary assets from a Vite build

Relevant only if Scan or the engine ever move client-side. Three ways to get a
`.onnx`/`.wasm` into the output, all verified in a real Start build:

1. **`public/`** → copied verbatim, unhashed, root-absolute, not importable from
   JS. A 1.3 MB `.onnx` came through byte-identical. You own cache-busting.
2. **`?url` import** → hashed and emitted (`dist/client/assets/model-<hash>.onnx`).
   Needs `assetsInclude: ['**/*.onnx']`. Better for immutable caching.
3. `vite-plugin-static-copy` 4.1.1 for pulling files out of `node_modules`.

`build.assetsInlineLimit` defaults to 4096, so tiny `.wasm` files get
base64-inlined; irrelevant at these sizes, and `public/` files are never inlined.

**Workers** work in the Start build, with Vite's constraints: the `new URL()`
must sit **directly inside** `new Worker()` and all options must be static
literals. `worker.format` defaults to `'iife'` — switch to `'es'` if the worker
uses dynamic `import()` or top-level await. `worker.plugins` must be a *function*
returning fresh instances; `config.plugins` only applies to workers in dev, which
is a classic dev-works/build-breaks trap.

**`onnxruntime-web` 1.29.0 import variants, measured:**

| Import | External wasm | Size |
|---|---|---|
| `onnxruntime-web` (default ESM) | `ort-wasm-simd-threaded.jsep.wasm` | **26.51 MB** |
| **`onnxruntime-web/wasm`** | `ort-wasm-simd-threaded.wasm` | **13.32 MB** |
| `onnxruntime-web/jspi` | `…jspi.wasm` | 15.28 MB |
| `onnxruntime-web/webgpu` | `…asyncify.wasm` | 24.56 MB |

⚠️ **The default import drags 26.5 MB** — 20× the model, and over Cloudflare's
25 MiB per-file cap. The working pattern:

```ts
// vite.config.ts
assetsInclude: ['**/*.onnx'],
optimizeDeps: { exclude: ['onnxruntime-web'] },   // the blessed fix
```
```ts
import * as ort from 'onnxruntime-web/wasm'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
ort.env.wasm.wasmPaths = { wasm: wasmUrl }
ort.env.wasm.numThreads = 1   // avoids SharedArrayBuffer / COOP-COEP
```

Root cause is [vite#8427](https://github.com/vitejs/vite/issues/8427) — the dep
optimizer rewrites break `new URL(…, import.meta.url)` inside deps. Microsoft
attempted a fix ([PR #23487](https://github.com/microsoft/onnxruntime/pull/23487))
then **reverted it** ([#23531](https://github.com/microsoft/onnxruntime/pull/23531)),
deferring to `optimizeDeps.exclude`. Note `wasmPaths` changed from a string to a
`{wasm, mjs}` object around 1.21/1.22 — old string-form code fails silently with
"no available backend found" ([#23515](https://github.com/microsoft/onnxruntime/issues/23515)).

⚠️ **pnpm gotcha:** `onnxruntime-web` pulls `protobufjs@7.6.6`, which has a
postinstall script, and pnpm 11 **fails the install** with
`ERR_PNPM_IGNORED_BUILDS` until it is allowlisted.

**MIME types are a non-issue.** `.wasm` is served as `application/wasm`;
`.onnx`/`.nnue` come back as `application/octet-stream`, which is harmless
because `fetch().arrayBuffer()` ignores Content-Type. MIME only matters for
`WebAssembly.instantiateStreaming`, and both Emscripten glues already fall back
to `WebAssembly.instantiate(arrayBuffer)` with a perf warning. The real UX
problem is a 14 MB first load, not MIME — set long cache headers.
