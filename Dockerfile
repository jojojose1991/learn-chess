# The app and the Stockfish it drives over UCI, in one image.
#
# Run it with at least 1 GiB (Cloud Run: `--memory 1Gi`). Stockfish 18 peaks at
# 377 MiB resident before Node's own 40–70 MiB, so the 512 MiB default is an
# OOM kill waiting for the first search (docs/learnings/deployment.md).

# Stockfish from the official tarball, not apt: Debian's package is a generic
# SSE2 build, and NNUE evaluation is where the move-time budget goes. Untarring
# is the same on any host, so this stage is not pinned to one.
#
# The checksum is the release's own: the server runs what comes out of here as
# a subprocess, so without it the image is whatever that URL serves on the day.
FROM debian:bookworm-slim AS stockfish
ADD --checksum=sha256:536c0c2c0cf06450df0bfb5e876ef0d3119950703a8f143627f990c7b5417964 \
  https://github.com/official-stockfish/Stockfish/releases/download/sf_18/stockfish-ubuntu-x86-64-avx2.tar \
  /tmp/stockfish.tar
RUN tar -xf /tmp/stockfish.tar -C /tmp \
  && mv /tmp/stockfish/stockfish-ubuntu-x86-64-avx2 /usr/local/bin/stockfish

# The bundle is JavaScript, so it builds on whatever the host is and only the
# runtime stage pays for emulation.
FROM --platform=$BUILDPLATFORM node:24-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# From `packageManager`, so the image, CI and a laptop cannot drift apart. Not
# corepack: it cannot fetch pnpm 12 (docs/learnings/deployment.md).
RUN npm install --global "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"
# Belt to `--ignore-scripts`' braces and to `allowBuilds`' own `false`: the
# postinstall would download CUDA and TensorRT providers this CPU service never
# runs (docs/learnings/board-recognition.md).
ENV ONNXRUNTIME_NODE_INSTALL=skip
# `--ignore-scripts`: `prepare` points git at .githooks, and there is no git
# and no repository here.
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm build
# A self-contained tree: still symlinked, but into a `.pnpm` store of its own,
# so the links resolve after the COPY. Without `--filter=.` pnpm selects
# nothing (`packages: []`); without `--legacy` it refuses this workspace.
RUN pnpm --filter=. deploy --prod --legacy --ignore-scripts /runtime

# After the deploy, never before: `pnpm deploy` re-resolves from the store and
# restores anything cut first. Neither is loadable here — a binding per
# platform, and the wasm runtime ADR-0003 rejected, present only as a peer.
# The `test` is what makes an unmatched glob fail rather than prune nothing.
RUN set -eu \
  && ORT="$(echo /runtime/node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v6)" \
  && test -d "$ORT/linux/x64" \
  && rm -rf "$ORT/darwin" "$ORT/win32" "$ORT/linux/arm64" \
  && rm -rf /runtime/node_modules/.pnpm/onnxruntime-web@* \
    /runtime/node_modules/.pnpm/node_modules/onnxruntime-web \
    /runtime/node_modules/.pnpm/@scoriiu+fenshot@*/node_modules/onnxruntime-web

# Pinned, and BuildKit's advice against a constant platform is declined here:
# the engine binary is x86_64 glibc, so an image built for anything else has a
# Stockfish that cannot run. Not Alpine for the same reason — the same binary
# on musl fails silently, with no output at all.
FROM --platform=linux/amd64 node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=stockfish /usr/local/bin/stockfish /usr/local/bin/stockfish
# Both read at call time by `src/lib/engine/service.ts`, and both properties
# of this image rather than of a deployment. Everything else — every secret
# included — is injected at deploy time, because a build arg is baked into the
# layer for anyone who pulls it.
ENV STOCKFISH_PATH=/usr/local/bin/stockfish
ENV ENGINE_MOVETIME_MS=200
# The server resolves its native binding and the model at runtime, so the store
# ships beside `dist/` (ADR-0006). First, because it changes less than `dist`.
COPY --from=build /runtime/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
# ADR-0006: why srvx rather than Nitro, and why `--static` must be absolute.
CMD ["node", "node_modules/srvx/bin/srvx.mjs", "serve", "--prod", \
  "--entry=/app/dist/server/server.js", "--static=/app/dist/client"]
