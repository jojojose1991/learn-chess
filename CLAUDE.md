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
