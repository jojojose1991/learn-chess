# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

pnpm is the package manager (`.cta.json`, `pnpm-workspace.yaml`).

```bash
pnpm dev         # vite dev server on port 3000
pnpm build       # production build
pnpm test        # vitest run
pnpm test <file> # single file, e.g. pnpm test src/foo.test.ts
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm format      # prettier --write
```

## Architecture

TanStack Start (SSR-capable React 19 + Vite 8) with the **file-based router**:

- `src/routes/` — each file is a route. `__root.tsx` owns the whole HTML document (`shellComponent`), `<head>` meta/links, the 404 page, and mounts TanStack Devtools.
- `src/routeTree.gen.ts` — **generated**, never edit by hand. The `tanstackStart()` Vite plugin regenerates it when files in `src/routes/` change.
- `src/router.tsx` — `getRouter()` is the entry point TanStack Start calls; it also declares the `Register` module augmentation that types `Link`/`useNavigate` across the app.
- `src/styles.css` — the single stylesheet, imported as a URL in `__root.tsx`. Tailwind v4 is CSS-configured (`@theme inline`, shadcn design tokens) — there is no `tailwind.config.js`.

## Conventions

- `@/*` maps to `src/*`.
- shadcn/ui with the `base-nova` style, `neutral` base color, `@base-ui/react` primitives and Tabler icons. Add components with `pnpm dlx shadcn@latest add <name>` — they land in `src/components/ui/`.
- Compose Tailwind classes through `cn()` (`src/lib/utils.ts`); Prettier is configured to sort classes inside `cn()` and `cva()`.
- Prettier: no semicolons, double quotes, 80 cols. TS is `strict` with `noUnusedLocals`/`noUnusedParameters`, so unused imports fail `pnpm typecheck`.
- Vitest has no config block yet — a DOM test needs `environment: "jsdom"` added to `vite.config.ts` (jsdom and Testing Library are already installed).

## Design documents

Read these before writing code. They are the product decisions, not suggestions.

- `CONTEXT.md` — the ubiquitous language. Use these terms in code, types, table
  names, routes and commit messages. Each entry lists rejected synonyms; do not
  reintroduce them.
- `docs/PLAN.md` — domain model, schema, module boundaries, interaction rules,
  the six screens, and the build order.
- `docs/adr/` — decisions with real trade-offs, and the evidence behind them.
  If a change contradicts an ADR, say so and revisit the ADR; do not silently
  diverge.
- `docs/BACKLOG.md` — what is deliberately out of scope, and what must stay true
  in the MVP so it can be added later. Do not build these.
- `docs/learnings/` — verified library facts, measured numbers and gotchas.
  Check here before trusting a library's own docs; several entries record where
  the official docs are wrong or out of date.

## How to work here

**Design before implementing.** For any non-trivial module or component,
dispatch an architecture subagent to produce a design first — module
responsibilities, the interfaces between them, and how the domain model maps to
types. Judge it against SOLID: single responsibility per module, interfaces that
callers can depend on without knowing the implementation, and extension without
modification. Then implement to that design rather than improvising.

**Extend only along axes a requirement already names.** The real extension
points, from the design session, are:

- **Goal kinds** — `mate_in` now, `win_material` next. A Goal is a predicate
  over board state, never a stored solution line (ADR-0001).
- **Opponent kinds** — a full-strength engine defender now, a deliberately weak
  hand-rolled mover later. Stockfish cannot go below 1320 Elo, so these are two
  implementations, not one with a setting.
- **Scan paths** — automatic detection now, manual four-corner warp on the
  unreliable path, both feeding one classifier (ADR-0002).
- **Board themes** — two, stored per Coach and stamped onto a Puzzle Link.
- **Student identity** — absent in the MVP, arriving as new tables plus a
  nullable column. Nothing may make that a schema rewrite.

Anything else is speculation. No interface with one implementation and no
prospect of a second.

**Keep the rules pure.** All chess logic lives in `src/lib/chess/` with no I/O,
no React and no framework imports, and it is the layer that carries tests. The
board component renders a Position and emits taps; it knows nothing about Goals,
engines or games.

**Cut before you review.** When the work is written and the checks pass, run
`/ponytail:ponytail-review` over the diff before `/code-review`. It hunts one
thing — over-engineering — and it is cheaper to delete a speculative
abstraction, a vendored component nothing imports or a dependency a stdlib call
covers while the diff is still yours than to argue about it afterwards. Then run
`/code-review` on what survives.

**Commit to `main`. Do not create branches.**

**Commit after each meaningful step** — a working module, a passing test suite, a
screen that renders — not one large commit at the end. Each commit should leave
`pnpm typecheck`, `pnpm lint` and `pnpm test` passing.

## Agent skills

### Issue tracker

Local markdown — issues and specs live as files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, used verbatim: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
