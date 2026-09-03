# Tracker

Where every MVP ticket stands, and what previous tickets left behind. The
tickets themselves are `.scratch/mvp/issues/NN-slug.md` and stay the source of
truth for scope and criteria — this file is the index over them, so it carries
status and pointers and never a second copy of a ticket's detail.

**7 of 21 resolved. Five tickets are actionable right now: 07, 12, 19, 20
and 21.**

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
| 18  | Admin: the accounts screen          | ✅ resolved     | —              |
| 07  | Tap-tap, Guidance, promotion picker | 🟢 **ready**    | 06 ✅          |
| 12  | Stockfish over UCI                  | 🟢 **ready**    | none           |
| 19  | Logging, dev and prod               | 🟢 **ready**    | none           |
| 20  | A Coach picks their board theme     | 🟢 **ready**    | 06 ✅          |
| 21  | A Library row says what it is       | 🟢 **ready**    | none           |
| 08  | Confirm & Edit saves a Puzzle       | ⬜ ready-for-agent | 07            |
| 09  | Play a Puzzle, local vs local       | ⬜ ready-for-agent | 08            |
| 10  | Solved / Not this time              | ⬜ ready-for-agent | 09            |
| 11  | Puzzle Links                        | ⬜ ready-for-agent | 10            |
| 13  | The engine defends, and Hint        | ⬜ ready-for-agent | 10, 12        |
| 14  | Scan a clean screenshot             | ⬜ ready-for-agent | 08            |
| 15  | The four-corner warp                | ⬜ ready-for-agent | 14            |
| 16  | Deploy to Cloud Run                 | ⬜ ready-for-agent | 13, 15        |
| 17  | Position rejection detail           | ❓ needs-triage | 14             |

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
| `readPlacement` throws on a placement-only FEN              | 14                                        | 06, `src/lib/chess/rules.ts`        |
| New Puzzle's taps go nowhere and its Position is hardcoded   | 08                                        | `src/routes/_coach/puzzles.new.tsx` |
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
| Nothing encodes castling as king-takes-rook (e1→h1)          | if tap-tap ever produces one              | 02                                  |
| A promotion with no piece chosen shares the generic reason    | something needing the two told apart      | 01                                  |
| The board's focus outline is under 3:1 at the base layer's 50% alpha | 07                                 | ADR-0005, `src/styles.css`          |
| The checker mark is under 3:1 and leans on the words beside it | the sidebar goes `collapsible="icon"`   | ADR-0005, `src/components/checker-mark.tsx` |
| Nothing declares `color-scheme`, so Android Chrome may invert it | a Coach reports the app looking dark   | `src/styles.css`                    |

`grep -rn "ponytail:" src scripts` is the code half of this list.

## Keeping this honest

- A ticket's `Status:` line is the truth; the table above is a copy. Update
  both, or neither is trustworthy.
- A finding simply **declined** belongs in that ticket's `## Comments` with its
  reason. Only what someone still has to do belongs here.
- When a trigger fires, the row becomes a ticket and leaves this file.
