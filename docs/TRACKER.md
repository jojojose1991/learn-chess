# Tracker

Where every MVP ticket stands, and what previous tickets left behind. The
tickets themselves are `.scratch/mvp/issues/NN-slug.md` and stay the source of
truth for scope and criteria — this file is the index over them, so it carries
status and pointers and never a second copy of a ticket's detail.

<!-- tracker:count -->

**24 of 28 resolved. Two tickets are actionable right now: 16 and 27.**
<!-- /tracker:count -->

## Tickets

**This table is generated — `pnpm tracker` writes it, do not edit it.** Every
column is read from the ticket files: the title from the `#` heading, the state
from `**Status:**`, the blockers from the first sentence of `**Blocked by:**`.
`ready` is computed rather than stored — a ticket is ready when it is
`ready-for-agent` and every ticket it waits on is resolved.

<!-- tracker:tickets -->

| #   | Ticket                                                       | Status          | Blocked by   |
| --- | ------------------------------------------------------------ | --------------- | ------------ |
| 01  | Chess rules core: validate, legal targets, apply move        | ✅ resolved     | —            |
| 02  | Illegal-move explanations and Goal evaluation                | ✅ resolved     | —            |
| 03  | Neon and Drizzle: schema, first migration, seed Coach        | ✅ resolved     | —            |
| 04  | Invite-only sign-in                                          | ✅ resolved     | —            |
| 05  | Library reads real Puzzles                                   | ✅ resolved     | —            |
| 06  | The board renders a Position                                 | ✅ resolved     | —            |
| 07  | Tap-tap moves, Guidance, and the promotion picker            | ✅ resolved     | —            |
| 08  | Confirm & Edit, saving a Puzzle to the Library               | ✅ resolved     | —            |
| 09  | Play a Puzzle, local versus local                            | ✅ resolved     | —            |
| 10  | Solved / Not this time                                       | ✅ resolved     | —            |
| 11  | Puzzle Links                                                 | ✅ resolved     | —            |
| 12  | Stockfish over UCI behind an engine route                    | ✅ resolved     | —            |
| 13  | The engine defends, and Hint                                 | ✅ resolved     | —            |
| 14  | Scan a clean screenshot                                      | ✅ resolved     | —            |
| 15  | The four-corner warp on the unreliable path                  | ✅ resolved     | —            |
| 18  | Admin: the accounts screen                                   | ✅ resolved     | —            |
| 19  | Logging, in development and in production                    | ✅ resolved     | —            |
| 20  | A Coach picks their board theme                              | ✅ resolved     | —            |
| 21  | A Library row says what the Puzzle is                        | ✅ resolved     | —            |
| 22  | `/admin` scrolls sideways on a phone                         | ✅ resolved     | —            |
| 24  | The engine's failures are visible somewhere                  | ✅ resolved     | —            |
| 25  | The accounts DTO spreads its row                             | ✅ resolved     | —            |
| 26  | The e2e suites each carry their own sign-in                  | ✅ resolved     | —            |
| 28  | The board locators are copied into four e2e specs            | ✅ resolved     | —            |
| 16  | Deploy to Cloud Run                                          | 🟢 **ready**    | 13 ✅, 15 ✅ |
| 27  | `issue-files.md` counts the tickets, and gets it wrong       | 🟢 **ready**    | —            |
| 17  | Does a rejected Position need to say more than one sentence? | ❓ needs-triage | 14 ✅        |
| 23  | What stops a stranger holding the engine open?               | ❓ needs-triage | 16           |

<!-- /tracker:tickets -->

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

| Owed                                                                                                                                                                                                                 | Trigger                                                                                                                                                      | Detail in                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Nothing bounds two Scans at once: a 12 MP image peaks near 300 MB against a 1 GiB container already holding Stockfish's 377 MiB                                                                                      | 16, where the container's memory is real, with ticket 23's ceiling on the engine route                                                                       | 14, `src/lib/scan/service.ts`                                          |
| The runtime image carries neither the pruned `node_modules` nor the classifier's `.onnx`, so the built server can resolve the model in dev and not in the image                                                      | 16                                                                                                                                                           | 14, `Dockerfile`                                                       |
| `onnxruntime-web` is auto-installed as fenshot's peer — 136 MB of wasm ADR-0003 rejected, in every install and every build layer                                                                                     | 16, if the image build time is measured; `packageExtensions` and `peerDependencyRules` were both tried and only repo-wide `autoInstallPeers: false` moves it | 14, `pnpm-lock.yaml`                                                   |
| The real-engine test skips wherever no Stockfish is installed                                                                                                                                                        | a suite runs where the binary is (16)                                                                                                                        | 12, 13, `tests/lib/engine/service.test.ts`, `tests/e2e/engine.spec.ts` |
| A failed handshake's kill and the line it now logs are untested, and eight queued searches each wait out the 5 s startup                                                                                             | the startup budget becomes reachable in a test                                                                                                               | 12, 24, `src/lib/engine/service.ts`                                    |
| The browser branch of `log`'s floor is untested: `import.meta.env.PROD` needs a jsdom file, and the log tests are node-only                                                                                          | 16, where the prod build is what ships                                                                                                                       | 19, `src/lib/log.ts`                                                   |
| The engine request has no client-side timeout, so a connection that stalls past the server's own 504 leaves the board locked until Rewind or Reset                                                                   | 11 or 16, where a Puzzle Link is played over a network we do not control                                                                                     | 13, `src/components/play-puzzle.tsx`                                   |
| The engine route has no rate limit and no body-size cap; an 8-deep queue is the ceiling                                                                                                                              | a Puzzle Link is live in production (11, 16)                                                                                                                 | Ticket 23                                                              |
| No `ucinewgame`, so one engine's table carries between Positions                                                                                                                                                     | a Puzzle's defence must be reproducible                                                                                                                      | 12                                                                     |
| The image has no `CMD`: `vite build` emits a handler, not a server                                                                                                                                                   | 16                                                                                                                                                           | 12, `Dockerfile`                                                       |
| The Stockfish URL and its checksum are pinned by hand                                                                                                                                                                | Stockfish 19, or a CVE in 18                                                                                                                                 | 12, `Dockerfile`                                                       |
| The Library route pulls a 35 kB chess.js chunk for two words                                                                                                                                                         | the Library's weight is measured (16)                                                                                                                        | 21, `src/lib/chess/goals.ts`                                           |
| `goal_kind` has no CHECK constraint, and `describeGoal` ignores it                                                                                                                                                   | a second Goal kind (`win_material`)                                                                                                                          | 21, `src/lib/chess/goals.ts`                                           |
| A board theme write that throws is silent, on screen and in the log                                                                                                                                                  | a Coach reports a theme that will not stick                                                                                                                  | 20, `src/components/app-sidebar.tsx`                                   |
| "Try again" on a Puzzle stored in checkmate resets to the same dead Position, so the banner comes straight back                                                                                                      | a Coach reports a Puzzle that cannot be started                                                                                                              | 10, `src/components/play-puzzle.tsx`                                   |
| An unplayable FEN now throws out of `startPlay`, on the Play route's first render rather than on the first tap, and an invalid one that parses is pronounced stalemate                                               | 16, where a Student meets `startPlay` unaccompanied — 11 put a slug in that URL and not a FEN, so its own trigger never fired                                | 09, 10, `src/lib/chess/goals.ts`                                       |
| Play writes the Puzzle before opening it, so playing one a Coach has not changed still touches `updated_at`                                                                                                          | a Library ordered by when a Puzzle last changed                                                                                                              | 09, `src/components/puzzle-editor.tsx`                                 |
| Save is `disabled` while the Position is illegal, and so are the file input and Read these corners while a Scan runs — unfocusable, so a screen reader meets neither the reasons nor the fact that anything started  | a Coach who reads the screen rather than sees it                                                                                                             | 08, 15, `src/components/puzzle-editor.tsx`                             |
| A hand-placed Position never carries castling rights, so neither side can castle in it                                                                                                                               | a Puzzle whose solution castles, or whose defender should be able to castle out of the mate net                                                              | 08, `src/lib/chess/rules.ts`                                           |
| `/admin/set-role` and `/admin/update-user` are refused at the route                                                                                                                                                  | promote and demote get a screen                                                                                                                              | 18                                                                     |
| `create-user` still accepts a `role` in its body                                                                                                                                                                     | a role that grants what an admin cannot                                                                                                                      | 18                                                                     |
| `shadcn`'s `field` is not installed; `Label` + `Input` do                                                                                                                                                            | a form needs more than a stacked label                                                                                                                       | 04                                                                     |
| `withDb`'s retry could apply a write twice                                                                                                                                                                           | a duplicate actually shows up                                                                                                                                | `src/db/index.ts`                                                      |
| Sign-in needs JavaScript                                                                                                                                                                                             | a Coach on a slow connection complains                                                                                                                       | `src/routes/sign-in.tsx`                                               |
| The sidebar's collapse lasts only until reload                                                                                                                                                                       | a Coach asks for it                                                                                                                                          | `src/routes/_coach.tsx`                                                |
| `pnpm seed` replaces `user.role` instead of merging into it                                                                                                                                                          | a second role carries product meaning                                                                                                                        | `scripts/seed-admin.ts`                                                |
| `board_theme` has no CHECK constraint                                                                                                                                                                                | a writer other than our own code                                                                                                                             | 06, `src/db/schema.ts`                                                 |
| `drizzle.config.ts` reads env at module scope                                                                                                                                                                        | a fix that is not worse than the problem                                                                                                                     | 03                                                                     |
| `public/pieces/LICENSE` has no extension, so `/credits` downloads it                                                                                                                                                 | revisiting ADR-0004                                                                                                                                          | 06                                                                     |
| Nothing encodes castling as king-takes-rook (e1→h1)                                                                                                                                                                  | still nothing does: a tap on your own piece reselects it                                                                                                     | 02, `src/components/move-board.tsx`                                    |
| A promotion with no piece chosen shares the generic reason                                                                                                                                                           | something needing the two told apart                                                                                                                         | 01                                                                     |
| Nothing holds the auto-dark opt-out; CDP emulation cannot observe it                                                                                                                                                 | a headless browser that can                                                                                                                                  | `docs/learnings/frontend-stack.md`                                     |
| The twelve piece sprites are URL-referenced, never imported                                                                                                                                                          | a piece needs recolouring per theme                                                                                                                          | ADR-0004, `src/components/board.tsx`                                   |
| `public/favicon.svg` keeps its own copy of the checker path                                                                                                                                                          | the mark's shape changes                                                                                                                                     | `src/assets/checker-mark.svg`                                          |
| `src/assets/*.svg` is outside prettier, eslint and typecheck                                                                                                                                                         | a second asset                                                                                                                                               | `package.json`                                                         |
| The checker mark is under 3:1 and leans on the words beside it                                                                                                                                                       | the sidebar goes `collapsible="icon"`                                                                                                                        | ADR-0005, `src/components/checker-mark.tsx`                            |
| The two-open-links behaviour of a Puzzle Link — which one `order by created_at desc limit 1` shows a Coach, and that revoking ends every one of them                                                                 | 16, where a real network makes two racing mints a thing rather than a theory                                                                                 | 11, `src/db/repositories/puzzle-links.ts`                              |
| Nothing throttles guesses at `/p/<slug>`: 40 bits and no rate limit on the one route a stranger reaches without a session                                                                                            | 23, where this product's ceiling on an unauthenticated route is decided                                                                                      | 11, Ticket 23                                                          |
| A mint and a revoke drop keyboard focus to `<body>` when the button that was pressed unmounts; both now announce themselves, neither restores focus                                                                  | 16, where the deployed screens are checked at all three widths                                                                                               | 11, `src/components/puzzle-share.tsx`                                  |
| `tests/routes/api/scan.test.ts` times out at vitest's 5 s default under a loaded machine — it loads the real ONNX classifier, and passes alone and in a quiet full run                                               | 16, where the suite runs somewhere with a known CPU budget                                                                                                   | 14, `tests/routes/api/scan.test.ts`                                    |
| Nothing holds the loupe's _rendering_. Its arithmetic has tests, but it is `aria-hidden`, so no test can name the element without reaching for a class and deleting the markup leaves the suite green                | 16, where all seven screens are walked at three widths on the deployed URL                                                                                   | 15, `src/components/corner-picker.tsx`                                 |
| Every Scan test re-imports the service under `resetModules`, so each pays its own `InferenceSession.create`; the two files carry a 15 s ceiling to absorb it and would not notice the session being rebuilt per call | 16, where the suite is timed somewhere other than a laptop running three builds                                                                              | 15, `tests/lib/scan/service.test.ts`                                   |
| No photograph has ever been scanned: 15's keystone fixture is a browser rendering, so glare, paper grain, shadow gradient and halftone stay unmeasured on every path                                                 | 16, the first deployment a Coach can point a phone at                                                                                                        | 15, `docs/learnings/board-recognition.md`                              |

`grep -rn "ponytail:" src scripts` is the code half of this list.

## Keeping this honest

- A ticket's `Status:` line is the only truth. The table above is generated
  from it, so change the ticket and run `pnpm tracker`; there is no second
  place to keep in step, and that is deliberate — 19 shipped and sat at
  `ready-for-agent` in its own file for two weeks while this table called it
  resolved.
- **The carried-forward table below is hand-written**, and stays that way. A
  debt has no source to derive it from but the person who owed it.
- A finding simply **declined** belongs in that ticket's `## Comments` with its
  reason. Only what someone still has to do belongs here.
- When a trigger fires, the row becomes a ticket and leaves this file.
