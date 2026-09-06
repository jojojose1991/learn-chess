# srvx serves the build, and Nitro is not on the deployment path

The container runs `srvx serve --prod` over the `dist/` that `vite build`
already emits. Nitro is not installed, and `vite.config.ts` gains no plugin.

This diverges from TanStack Start's own hosting guide, which says to follow
Nitro's deployment instructions and start the app with
`node .output/server/index.mjs`. The divergence is deliberate and is the point
of this record.

## Why

**Nitro has no stable release.** npm `latest` for `nitro` is a date-stamped
beta (`3.0.260903-beta` at the time of writing) and the package carries an
"under active development" warning. The alternative,
`@tanstack/nitro-v2-vite-plugin@1.155.0`, was last published 2026-05-15 and
wraps `nitropack` 2.x. One is pre-release; the other is four months behind the
Start version this app runs. Start is itself an RC, and putting a second
pre-GA dependency underneath it on the one path that must work in production
buys risk this app has no use for.

**What Nitro is for here does not apply.** Its advantage as a deploy target is
a self-contained `.output/` that needs no `node_modules` at runtime. Two things
in this app defeat that, and both were read out of a real build rather than
assumed:

```js
// dist/server/assets/router-*.js
import * as ort from "onnxruntime-node";
createRequire(import.meta.url).resolve("@scoriiu/fenshot/model/chess-tiles-v2.onnx")
```

`onnxruntime-node` stays a bare external because its `.so` and `.node` files
are not bundleable, and the classifier's model is resolved from disk at call
time, relative to whatever file is running. The runtime image therefore carries
`node_modules` either way. With Nitro it would carry `node_modules` *and* a
`traceDeps` configuration to debug; `docs/learnings/deployment.md` already
flags that externalisation as the thing most likely to bite.

**srvx is not an alternative to Nitro — it is what Nitro's node preset runs
on.** It is already in the lockfile at `0.11.22`, pulled in by
`@tanstack/start-plugin-core`, has zero dependencies of its own and a normal
stable version. `vite build` emits `export default createServerEntry({ fetch })`,
which is exactly the interface srvx's CLI documents. Start's own preview server
loads the same artefact and calls `.fetch()` on it through `srvx/node`.

Measured, against this app's build: `/sign-in`, `/favicon.svg`, `/robots.txt`
and a hashed `assets/*.js` chunk all answered 200. srvx reads `PORT` and binds
all interfaces, which is Cloud Run's container contract without configuration.

## Consequences

**`--static` takes an absolute path.** srvx resolves it relative to the entry
file's own directory, not the working directory (`dist/cli.mjs`), so
`--static=dist/client` beside `--entry=dist/server/server.js` silently resolves
to `dist/server/dist/client`, finds nothing, and serves no static files at all.
The HTML still renders and every asset 404s, so the app appears to boot and
then does not hydrate. The `Dockerfile` passes an absolute path for this
reason.

**Prerendering, route rules and other deploy targets are not available.** Nitro
provides those and srvx does not. Nothing in the MVP wants them; a requirement
that does is the trigger to revisit this.

**The Start docs will keep saying Nitro.** Anyone following them will find no
`.output/` and no `nitro` in `package.json`. That is what this record is for.
Revisit when Nitro reaches a stable release, or when Start's Vite build stops
emitting a `{ fetch }` default export.
