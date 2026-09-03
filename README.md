# Learn Chess

A board for setting up a chess position — from a screenshot, a photo, or by
hand — and then playing it out. A Coach attaches a Goal ("mate in 2") and
either demonstrates the Puzzle live or sends a Student an unlisted link to
solve it. Not a place to play games from the opening.

TanStack Start (React 19, Vite 8, SSR) · Postgres via drizzle · BetterAuth ·
Tailwind v4 with shadcn/ui.

## Running it

```bash
pnpm install
pnpm prepare                 # points git at .githooks (commitlint)
cp .env.example .env         # then fill it in; the comments say what each is for
pnpm db:migrate              # needs DATABASE_URL_UNPOOLED
pnpm seed                    # the first Coach, and the only way admin is granted
pnpm dev                     # http://localhost:3012
```

Access is invite-only: there is no sign-up route. `pnpm seed` mints the admin
named by `SEED_ADMIN_USER`, and every other Coach is added on `/admin`.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test                    # vitest; needs no database and no server
```

End-to-end tests are separate, because they need both:

```bash
docker compose up -d         # postgres on 5433
pnpm e2e:db                  # migrate + seed the template, clone it
pnpm e2e                     # playwright
```

## Where things are

| | |
| --- | --- |
| `src/routes/` | file-based routes; `_coach/` is behind the auth guard |
| `src/lib/<domain>/` | `index.ts` controllers → `service.ts` rules → `rules.ts` shared policy |
| `src/lib/chess/` | the domain: pure functions, no I/O |
| `src/db/` | schema, migrations and one repository per table |
| `tests/` | every test, mirroring the source path |

`src/routeTree.gen.ts` and `src/db/auth-schema.ts` are generated — never edit
them by hand.

## Documents

- [CONTEXT.md](./CONTEXT.md) — the ubiquitous language, and the synonyms it rejects
- [docs/PLAN.md](./docs/PLAN.md) — domain model, schema, the six screens, build order
- [docs/adr/](./docs/adr) — decisions with real trade-offs, and the evidence
- [docs/BACKLOG.md](./docs/BACKLOG.md) — what is deliberately out of scope
- [docs/learnings/](./docs/learnings) — verified library facts and gotchas, several recording where official docs are wrong
- [CLAUDE.md](./CLAUDE.md) — the working rules: layers, testing, the commit loop
