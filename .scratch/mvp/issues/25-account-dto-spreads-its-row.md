# 25 — The accounts DTO spreads its row

**What to build:** A map that names what crosses to the client, in the one
service that spreads a row into its DTO instead.
`listAccounts` (`src/lib/accounts/service.ts:41`) builds `Account` with
`({ banned, ...row }) => ({ ...row, revoked: Boolean(banned) })`. TypeScript's
excess-property check does not fire through a spread, so a column added to
`listCoachesWithPuzzleCounts`'s select reaches the browser silently and
`pnpm typecheck` stays green — the one rule in AGENTS.md's Layers table that
the compiler cannot hold for us.

Name the fields. Then look at the other services for the same shape: the fix
is worth nothing if it lands in one file and the pattern survives elsewhere.

**Blocked by:** nothing.

**Status:** resolved

- [x] `Account` is built field by field, so a new column on that select cannot reach the client
- [x] Adding a column to the repository's select does not change what `/admin` receives
- [x] Every other service that maps a row to a DTO is checked for the same spread, and the finding recorded either way
- [x] A test fails if a field is added to the DTO without being named
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

Audited all services for the spread pattern:
- `src/lib/puzzles/service.ts`: `listLibrary` and `readPuzzle` already map field by field.
- `src/lib/puzzle-links/service.ts`: `openLink` already maps field by field.
- `src/lib/board-theme/service.ts`, `src/lib/engine/service.ts`, `src/lib/scan/service.ts`: no DB rows mapped to DTOs.
`src/lib/accounts/service.ts` was the sole location where a database row was spread into a DTO.
