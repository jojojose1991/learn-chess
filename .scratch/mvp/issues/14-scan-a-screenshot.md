# 14 — Scan a clean screenshot

**What to build:** The other way into a Puzzle. From New Puzzle a Coach picks
an image of a board and gets a draft Position open in Confirm & Edit for them
to check. A Scan always produces a draft for a person to check, never a
Position that goes straight into play.

Use fenshot's classifier and its detector for clean screenshots, but never its
`resolveOrientation` as an applied transform (ADR-0002) — it pre-sets a visible
toggle only, and is skipped when either side has fewer than three pawns.
Measured: it rotated an already-perfect mate-in-1 read by 180°, costing 10
squares, because it infers orientation from pawn advancement and composed
puzzles have deeply advanced pawns.

Set `ONNXRUNTIME_NODE_INSTALL=skip` in the build — left alone its postinstall
fetches hundreds of MB of CUDA and TensorRT providers this service will never
run. It must **not** go in `allowBuilds`. Prune the non-Linux prebuilts; the
package unpacks to ~296 MB and linux/x64 needs ~43 MB.

The Goal is not read from the image; the person types N.

**Blocked by:** 08 (Confirm & Edit).

**Status:** ready-for-agent

- [ ] Uploading a clean screenshot of a board produces a draft Position in Confirm & Edit
- [ ] The scan route returns placement plus `reliable`, mean and minimum confidence
- [ ] A confident read of a real screenshot places all 64 squares correctly
- [ ] The orientation suggestion pre-sets a visible toggle and is never applied to the placement
- [ ] The suggestion is skipped when either side has fewer than three pawns
- [ ] An unreliable read says so plainly rather than presenting a bad draft as good
- [ ] A non-image or oversized file is refused at the boundary with a clear message
- [ ] The uploaded image is held only for the life of the request and never persisted
- [ ] The image runs the classifier with the ONNX install script skipped and no GPU providers downloaded
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
