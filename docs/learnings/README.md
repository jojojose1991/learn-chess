# Learnings

Research gathered while designing the MVP (September 2026). Kept because most of
it is expensive to re-derive and some of it contradicts what the official docs
say. Every claim is either read from source, measured, or flagged as unverified.

- [board-recognition.md](./board-recognition.md) — the image→FEN landscape,
  `fenshot` internals, and a measured experiment against four real user images.
- [chess-libraries.md](./chess-libraries.md) — rules engines, board UI options,
  and why a chess engine cannot be made weak enough for a beginner.
- [piece-assets.md](./piece-assets.md) — piece artwork licensing: which sets are
  quietly non-commercial, and why Cburnett's are taken under BSD rather than
  CC BY-SA.
- [frontend-stack.md](./frontend-stack.md) — TanStack Start, shadcn `base-nova`,
  Tailwind v4, and what is and isn't tied to Next.js.
- [deployment.md](./deployment.md) — Docker on Cloud Run, Neon, Drizzle
  migrations, BetterAuth, Resend, native Stockfish, and `onnxruntime-node`.
- [testing.md](./testing.md) — three things that passed typecheck, lint and the
  whole unit suite while the app was broken: a server-fn module's re-exports
  reaching the client bundle, a form submitting natively before it hydrates,
  and postgres 18's moved data directory.

Versions are as of 2026-09-02. Check before trusting any of them a year from now.
