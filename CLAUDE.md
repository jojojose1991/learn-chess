# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

pnpm is the package manager (`.cta.json`, `pnpm-workspace.yaml`).

```bash
pnpm dev         # vite dev server on PORT from .env (3012)
pnpm build       # production build
pnpm test        # vitest run
pnpm test <file> # single file, e.g. pnpm test tests/lib/chess/rules.test.ts
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm format      # prettier --write
```

The interactive shell here is **fish**, which has no heredocs, no
`export FOO=bar`, no `VAR=x cmd` prefix and no `[[ ]]`. `.claude/settings.json`
pins the harness to `/bin/bash`, so tool calls can use POSIX freely. Anything
committed to `scripts/` must run under `#!/usr/bin/env bash`, not fish.

## Architecture

TanStack Start (SSR-capable React 19 + Vite 8) with the **file-based router**:

- `src/routes/` — each file is a route. `__root.tsx` owns the whole HTML document (`shellComponent`), `<head>` meta/links, the 404 page, and mounts TanStack Devtools.
- `src/routeTree.gen.ts` — **generated**, never edit by hand. The `tanstackStart()` Vite plugin regenerates it when files in `src/routes/` change.
- `src/router.tsx` — `getRouter()` is the entry point TanStack Start calls; it also declares the `Register` module augmentation that types `Link`/`useNavigate` across the app.
- `src/styles.css` — the single stylesheet, imported as a URL in `__root.tsx`. Tailwind v4 is CSS-configured (`@theme inline`, shadcn design tokens) — there is no `tailwind.config.js`.

### Layers

Three, and imports flow one way only: **controller → service → repository**.
Nothing ever imports back up.

| Layer | Lives in | May import |
| --- | --- | --- |
| Controller | `src/routes/**`, and the `createServerFn` exports in `src/lib/<domain>/index.ts` | services |
| Service | `src/lib/<domain>/service.ts` | repositories, `src/lib/auth.ts`, the pure libs |
| Repository | `src/db/repositories/<table>.ts` | `drizzle-orm`, `@/db`, `@/db/schema` |

- A **controller** validates input, reads the request (`getRequestHeaders()`),
  calls one service function and shapes the answer. No rules, no queries.
- A **service** holds the rules: who may do this, what is valid, what a thing
  is called. It takes `headers: Headers` as an argument rather than reaching
  for the request, and it never touches `drizzle`.
- A **repository** is queries. It returns rows as the database has them and
  knows nothing about HTTP, sessions or `Response`.
- **Never return a database row to the client.** The service maps it to an
  explicit DTO — that is where `user.banned` becomes `Account.revoked`.
- **The service owns the transaction boundary**, not the repository and not the
  controller.
- **A service throws or returns a domain error; the controller maps it to
  HTTP.** Today's failures collapse into `{ error: string }` carrying
  BetterAuth's own message. That is deliberate — only an admin reads it — and
  it is the ceiling, not the pattern to copy to a Coach-facing screen.
- `src/lib/chess/` is not a service layer, it is the domain: pure functions,
  no I/O, and a service may call it freely.
- One file is a layer. Do not create a folder per layer per domain until there
  is a second thing to put in it.

### Server routes

`src/routes/api/**` is a thin surface and stays one: `/api/auth/$` (BetterAuth's
own, whose shape is not ours), `/api/scan` and `/api/engine/move`. Those two are
**actions, not resources** — POST, one job each, validated input, an explicit
error shape and honest status codes. Everything else is `createServerFn` RPC by
design; do not reshape it into resource URLs.

If a genuine CRUD resource ever appears, it follows REST properly: plural
lowercase-kebab nouns, verbs in the method, nesting only where the child cannot
exist alone, 401 vs 403 vs 404 chosen deliberately, and one error envelope. No
verbs in paths, no `?action=`, and never a 200 with an error inside.

## Conventions

- `@/*` maps to `src/*`.
- shadcn/ui with the `base-nova` style, `neutral` base color, `@base-ui/react` primitives and Tabler icons. Add components with `pnpm dlx shadcn@latest add <name>` — they land in `src/components/ui/`.
- Compose Tailwind classes through `cn()` (`src/lib/utils.ts`); Prettier is configured to sort classes inside `cn()` and `cva()`.
- Prettier: no semicolons, double quotes, 80 cols. TS is `strict` with `noUnusedLocals`/`noUnusedParameters`, so unused imports fail `pnpm typecheck`.
- **All tests live in `tests/`**, mirroring the source path — `src/lib/chess/rules.ts` is tested by `tests/lib/chess/rules.test.ts`. None beside the source. Tests import through `@/*`, never relative paths.
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
no React and no framework imports, and it is the layer the suite leans on
hardest (`tests/lib/chess/`). The board component renders a Position and emits
taps; it knows nothing about Goals, engines or games.

**The loop for one unit of work**, in order, and the order is the point:

1. **Write the test first.** Red before green — the failing test states what
   the change is for, then the implementation makes it pass.
   `/mattpocock-skills:tdd` drives this if you want it driven. This binds
   anything with logic in it: `src/lib/**`, services, repositories, reducers.
   A screen or a component is exempt only until `environment: "jsdom"` is in
   `vite.config.ts`; add it rather than skipping the test.
2. **Implement to green**, and get `pnpm typecheck`, `pnpm lint` and `pnpm test`
   passing.
3. **`/ponytail:ponytail-review` over the diff, in a subagent.** Dispatch it
   through the Agent tool and take back its findings list, not its running
   commentary. It hunts one thing — over-engineering — and it is cheaper to
   delete a speculative abstraction, a vendored component nothing imports or a
   dependency a stdlib call covers while the diff is still yours than to argue
   about it afterwards.
4. **`/code-review` on what survives**, also in a subagent.
5. **Apply the fixes**, and re-run the three checks.
6. **Then commit.** Once, at the end, with the review's cuts already in it.

**Nothing is committed mid-loop.** A commit is a unit that has been reviewed,
not one that merely runs. Reviewing before committing is what makes the review
cheap: the diff is still yours to throw away, and the history does not record
the abstraction that got deleted four minutes later.

That still means several commits per feature, not one at the end of a phase —
a module, a screen, a migration is each its own trip through the loop. Each
commit leaves `pnpm typecheck`, `pnpm lint` and `pnpm test` passing.

When a finding is declined, say so in the commit message with the reason. A
review that was overruled silently is a review nobody can audit.

**Commit to `main`. Do not create branches.**

## Agent skills

### Issue tracker

Local markdown — issues and specs live as files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, used verbatim: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
