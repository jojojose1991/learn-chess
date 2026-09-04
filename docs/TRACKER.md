# Tracker

Where every MVP ticket stands, and what previous tickets left behind. The
tickets themselves are `.scratch/mvp/issues/NN-slug.md` and stay the source of
truth for scope and criteria — this file is the index over them, so it carries
status and pointers and never a second copy of a ticket's detail.

**11 of 24 resolved. Four tickets are actionable right now: 08, 20, 22
and 24.**

## Tickets

`ready` means every blocker is resolved. Status strings are the five in
`docs/agents/triage-labels.md`, read from each ticket's own `Status:` line.

| #   | Ticket                              | Status          | Blocked by     |
| --- | ----------------------------------- | --------------- | -------------- |
| 01  | Chess rules core                    | ✅ resolved     | —              |
| 02  | Illegal-move explanations and Goals | ✅ resolved     | —              |
| 03  | Schema, first migration, seed Coach | ✅ resolved     | —              |
| 04  | Invite-only sign-in                 | ✅ resolved     | —              |
| 05  | Library reads real Puzzles          | ✅ resolved     | —              |
| 06  | The board renders a Position        | ✅ resolved     | —              |
| 07  | Tap-tap, Guidance, promotion picker | ✅ resolved     | —              |
| 18  | Admin: the accounts screen          | ✅ resolved     | —              |
| 12  | Stockfish over UCI                  | ✅ resolved     | —              |
| 19  | Logging, dev and prod               | ✅ resolved     | —              |
| 21  | A Library row says what it is       | ✅ resolved     | —              |
| 20  | A Coach picks their board theme     | 🟢 **ready**    | 06 ✅          |
| 08  | Confirm & Edit saves a Puzzle       | 🟢 **ready**    | 07 ✅          |
| 22  | `/admin` scrolls sideways at 390px  | 🟢 **ready**    | none           |
| 24  | The engine's failures are logged    | 🟢 **ready**    | none           |
| 09  | Play a Puzzle, local vs local       | ⬜ ready-for-agent | 08            |
| 10  | Solved / Not this time              | ⬜ ready-for-agent | 09            |
| 11  | Puzzle Links                        | ⬜ ready-for-agent | 10            |
| 13  | The engine defends, and Hint        | ⬜ ready-for-agent | 10 (12 ✅)    |
| 14  | Scan a clean screenshot             | ⬜ ready-for-agent | 08            |
| 15  | The four-corner warp                | ⬜ ready-for-agent | 14            |
| 16  | Deploy to Cloud Run                 | ⬜ ready-for-agent | 13, 15        |
| 17  | Position rejection detail           | ❓ needs-triage | 14             |
| 23  | Engine route hardening              | ❓ needs-triage | 16             |

Build order and the reasoning behind it are `docs/PLAN.md`. It is not the same
as ticket order: 12 and 19 sit off the critical path on purpose, so the engine
and the logs can be proven while the screens are still being built.

**Responsiveness has no ticket, deliberately.** The rule is one paragraph in
`docs/PLAN.md` — phone, tablet and desktop, one layout that bends — and each
screen's own ticket carries it as a criterion, because a screen is responsive
when it is built or it is rework. 16 is where all seven are checked at all
three widths on the deployed URL. Do not file a ticket to make the app
responsive afterwards.

## Carried forward

Deferrals made **during** a build — a review finding not taken, or a shortcut
taken knowingly. Every one names the trigger that makes it live again, because
a deferral with no trigger is one nobody revisits. Detail stays where it was
written; this is the index.

Not the same list as `docs/BACKLOG.md`, which is what design chose not to build
at all. A backlog entry is a feature someone might pick up; these are debts
already owed by code that shipped. Do not merge them.

| Owed                                                        | Trigger                                   | Detail in                           |
| ----------------------------------------------------------- | ----------------------------------------- | ----------------------------------- |
| A rejected Position may need more than one sentence         | 14                                        | Ticket 17                           |
| The real-engine test skips wherever no Stockfish is installed | a suite runs where the binary is (16)   | 12, `tests/lib/engine/service.test.ts` |
| A failed handshake's kill is untested, and eight queued searches each wait out the 5 s startup | the startup budget becomes reachable in a test | 12, `src/lib/engine/service.ts` |
| The engine route has no rate limit and no body-size cap; an 8-deep queue is the ceiling | a Puzzle Link is live in production (11, 16) | Ticket 23 |
| No `ucinewgame`, so one engine's table carries between Positions | a Puzzle's defence must be reproducible | 12                                  |
| The image has no `CMD`: `vite build` emits a handler, not a server | 16                                      | 12, `Dockerfile`                    |
| The Stockfish URL and its checksum are pinned by hand         | Stockfish 19, or a CVE in 18              | 12, `Dockerfile`                    |
| The Library route pulls a 35 kB chess.js chunk for two words | the Library's weight is measured (16)     | 21, `src/lib/chess/goals.ts`        |
| `goal_kind` has no CHECK constraint, and `describeGoal` ignores it | a second Goal kind (`win_material`) | 21, `src/lib/chess/goals.ts`        |
| `readPlacement` throws on a placement-only FEN              | 14                                        | 06, `src/lib/chess/rules.ts`        |
| New Puzzle's Position is hardcoded, it hosts Play's Guidance toggle, and `board.spec.ts`'s promotion journey plays nine moves from it | 08 | `src/routes/_coach/puzzles.new.tsx` |
| "Never shrinks beside the move list" is untested             | 09                                        | 06                                  |
| `/admin/set-role` and `/admin/update-user` are refused at the route | promote and demote get a screen   | 18                                  |
| `create-user` still accepts a `role` in its body             | a role that grants what an admin cannot   | 18                                  |
| `shadcn`'s `field` is not installed; `Label` + `Input` do     | a form needs more than a stacked label    | 04                                  |
| `withDb`'s retry could apply a write twice                   | a duplicate actually shows up             | `src/db/index.ts`                   |
| Sign-in needs JavaScript                                     | a Coach on a slow connection complains    | `src/routes/sign-in.tsx`            |
| The sidebar's collapse lasts only until reload               | a Coach asks for it                       | `src/routes/_coach.tsx`             |
| `pnpm seed` replaces `user.role` instead of merging into it   | a second role carries product meaning     | `scripts/seed-admin.ts`             |
| `board_theme` has no CHECK constraint                        | a writer other than our own code          | 06, `src/db/schema.ts`              |
| `drizzle.config.ts` reads env at module scope                | a fix that is not worse than the problem  | 03                                  |
| `public/pieces/LICENSE` has no extension, so `/credits` downloads it | revisiting ADR-0004               | 06                                  |
| Nothing encodes castling as king-takes-rook (e1→h1)          | still nothing does: a tap on your own piece reselects it | 02, `src/components/move-board.tsx` |
| A promotion with no piece chosen shares the generic reason    | something needing the two told apart      | 01                                  |
| A selection outlives the Position changing under it, so the next tap emits a move the screen drops in silence | 09, where Rewind and Reset change it | `src/components/move-board.tsx` |
| `MoveBoard` passes the board neither orientation nor theme   | 09 flips one, or 20 puts brown on Play    | `src/components/move-board.tsx`     |
| `/admin` scrolls sideways at 390px by 120px, so `responsive.spec.ts` is red | now: it fails on `main` too | Ticket 22 |
| Nothing holds the auto-dark opt-out; CDP emulation cannot observe it | a headless browser that can       | `docs/learnings/frontend-stack.md`  |
| The twelve piece sprites are URL-referenced, never imported   | a piece needs recolouring per theme       | ADR-0004, `src/components/board.tsx` |
| `public/favicon.svg` keeps its own copy of the checker path   | the mark's shape changes                  | `src/assets/checker-mark.svg`       |
| `src/assets/*.svg` is outside prettier, eslint and typecheck  | a second asset                            | `package.json`                      |
| The checker mark is under 3:1 and leans on the words beside it | the sidebar goes `collapsible="icon"`   | ADR-0005, `src/components/checker-mark.tsx` |

`grep -rn "ponytail:" src scripts` is the code half of this list.

## Keeping this honest

- A ticket's `Status:` line is the truth; the table above is a copy. Update
  both, or neither is trustworthy.
- A finding simply **declined** belongs in that ticket's `## Comments` with its
  reason. Only what someone still has to do belongs here.
- When a trigger fires, the row becomes a ticket and leaves this file.
