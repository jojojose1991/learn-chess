# 11 — Puzzle Links

**What to build:** How a Coach gets a Puzzle to a Student. From a saved Puzzle
they mint a short unlisted URL, stamped with the board theme they teach on so
the Student sees the same board. Opening it lands straight on Play — no
sign-in, no library, no navigation, no editing. The Coach can revoke it.

**Blocked by:** 10 (Solved / Not this time).

**Status:** resolved

- [x] Minting produces an 8-character unlisted slug for one Puzzle, and the Coach can copy it
- [x] Opening the link in a browser with no session lands directly on Play with that Puzzle
- [x] The Student sees no sign-in prompt, no Library, no navigation and no way to edit the Position
- [x] The board theme is the one stamped on the link, not the viewer's or a default
- [x] Changing the Coach's theme afterwards does not change an already-minted link
- [x] Revoking the link makes it refuse politely, and it stays refused
- [x] An unknown slug is refused the same way, revealing nothing about which Puzzles exist
- [x] Play on a 390px phone needs no sideways scrolling, since that is where a Student meets the link
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

**The e2e journey was written and never run**, because this was built in a
worktree and `pnpm e2e` is single-instance over a database two other worktrees
share. `tests/e2e/puzzle-link.spec.ts` is therefore unrun and goes red for the
first time in the orchestrator's suite. Four of the boxes above are ticked on
it alone: that a sessionless browser lands on Play, that the Student's screen
carries no sign-in, Library or navigation, that the refusal page is what a
revoked and an unknown slug both draw, and the 390px width. What is proven
below it is `tests/lib/puzzle-links/service.test.ts` — the stamped theme
surviving a Coach's theme change, minting and revoking refused over another
Coach's Puzzle, and a revoked slug reading as null exactly as an unknown one
does — and `tests/components/puzzle-share.test.tsx` for the Coach's block.

**No migration.** `puzzle_link` shipped in `drizzle/0000_cheerful_may_parker.sql`
with ticket 03; `pnpm db:generate` reports no schema change. Nothing here is
waiting on the database.

**Decisions the diff does not explain:**

- **One open link per Puzzle.** Minting again hands back the link that exists
  rather than a second one, and revoking ends _every_ open link to the Puzzle —
  so two taps racing each other cannot leave a live slug the Coach has no way
  to see or revoke. The schema is left alone (no partial unique index), because
  `docs/PLAN.md`'s growth path hangs a nullable `student_profile_id` on this
  table, and that means many live links per Puzzle later.
- **A Coach's later edits reach the Student; the board does not.** The slug
  resolves the Puzzle by id, so fixing a typo or a Position is visible on a
  link already sent — which is what a Coach would expect of a link to _their
  Puzzle_. The theme is the one exception, stamped at minting, because that is
  the ticket's own criterion.
- **The whole URL is built on the server** from `BETTER_AUTH_URL`, which is
  already the origin the session cookie is set for. `window.location.origin` is
  empty during SSR, so a readonly input holding it either mismatches on
  hydration or needs an effect to fill in.
- **Ownership is checked once, in the service**, and none of the three link
  queries carries a Coach. `updatePuzzleByCoach` scopes in the `where` instead,
  and that is the better shape — but it puts the only security rule in this
  ticket in SQL that no test below e2e can reach, and the e2e cannot reach it
  either (a Coach has no screen from which to revoke another Coach's Puzzle).
  In the service it is held by a test that fails when it is removed.

**Findings declined, with the reason:**

- _Re-draw once on a slug collision_ (code review 3, architecture 4). The
  insert is a single draw from 2^40. A repeat is refused by the primary key,
  the Coach's screen already says "That did not work. Try again." for any
  failed mint, and a retry branch no test can reach is worse than the odds it
  covers. The comment in `service.ts` states the birthday bound honestly.
- _A slug-shape guard before the query_ (code review 9). It would refuse only
  malformed slugs, and anyone enumerating sends well-formed ones. The real
  ceiling is that `openLink` has no rate limit, which is ticket 23's subject.
- _Drop the blocked-clipboard message_ (ponytail, screens). A clipboard write
  that fails is invisible, and the Coach's next act is to paste — silently
  sending an empty message to a parent is the failure this prevents.
- _Trust `board_theme` as `goal_kind` is trusted_ (code review 11). It is one
  call to `boardThemeOf`, which already exists as the single list of what that
  column may hold, and the failure it prevents is sixty-four colourless squares
  in front of a five-year-old.
- _An independent uuid check in the test's fake_ (ponytail, domain). It stands
  in for postgres raising on a uuid column, not for the app's own rule —
  importing `isPuzzleId` there would let a broken guard agree with itself.
- _Move focus after a mint and a revoke_ (code review 4). The announcement half
  was taken — both now speak through the block's live region — but moving focus
  is carried forward rather than declined, and has a row in `docs/TRACKER.md`.
- _Fold `/p/<slug>` into `tests/e2e/responsive.spec.ts`_ (code review 11). That
  spec loops three widths over a list of static paths; a Puzzle Link's path
  does not exist until a Coach has signed in and minted one. The four-line
  overflow helper is duplicated deliberately rather than growing that spec a
  setup hook it has no other use for.
- _Rename `PuzzleShare`_ (code review 14). `CONTEXT.md` rejects "share link" as
  a name for the thing; this is "share" as the verb, over a block whose label,
  props and heading all say Puzzle Link.
- _Have `fetchPuzzle` return the link too_ (code review 8). It would put a
  Puzzle Link in the puzzles service to save one concurrent round trip, and
  the two domains are separate on purpose.
