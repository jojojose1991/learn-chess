# Stockfish and Scan run on the server, not as wasm in the browser

Both compute jobs run in the container: native Stockfish driven over UCI, and
the Scan classifier under `onnxruntime-node`. The browser downloads neither.

## Why

The browser alternative costs roughly 20 MB of wasm — about 7 MB for
`stockfish-18-lite-single` and about 13 MB for `onnxruntime-web/wasm` — against
a stated requirement that a Coach's laptop stay light while demonstrating over a
video call. Native Stockfish is also far faster and unconstrained by the
single-threaded wasm build, and the licensing position is simpler: running
GPL-3.0 Stockfish as a hosted service is not distribution to users, whereas
shipping its wasm to every browser is.

The cost is a network round trip per engine move and a possible cold start on
the first one. Puzzles are at most a few moves deep, so this is a handful of
requests per session rather than a stream; `min-instances: 1` buys away the cold
start if it is noticeable.

## Consequences

Rule enforcement stays in the browser regardless — Guidance highlighting and
illegal-move rejection cannot wait on a round trip, so `chess.js` runs
client-side and is the authority on legality. The server is stateless per
request: it takes a position and returns a move, or takes an image and returns a
placement. Game state lives in the client, which is acceptable because nothing
is recorded and there is no ranking to cheat for. If Attempt recording arrives
(see BACKLOG), it records what the client reports rather than replaying games
server-side.

Scanned images are held only for the life of the request and never persisted.
