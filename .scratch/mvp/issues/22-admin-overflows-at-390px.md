# 22 — `/admin` scrolls sideways on a phone

**What to fix:** At 390px the Accounts screen reaches 120px past the viewport,
so the page has a horizontal scrollbar and has to be dragged before it can be
read. `tests/e2e/responsive.spec.ts` is red on `main` because of it, and has
been since 18 shipped — the responsiveness rule in `docs/PLAN.md` says one
layout that bends at all three widths, and this is the one screen that does
not.

The cause is not confirmed, only suspected: `src/routes/_coach/admin.tsx`
draws a four-column `<table className="w-full">` whose cells carry an email
address and an inline password form. `w-full` does not stop a table from
exceeding its container when the intrinsic minimum width of its content is
wider, and neither the email nor the form wraps. Confirm it before fixing it.

This is the only red test on `main`, which makes it the one that teaches people
to ignore a red suite. That is the reason it is a ticket and not a line in a
backlog.

**Blocked by:** None — it fails today.

**Status:** ready-for-agent

- [ ] `/admin` reaches 0px past the viewport at 390px, 820px and 1280px
- [ ] Every account's name, email, Puzzle count and access state is still
      readable at 390px without sideways scrolling
- [ ] The per-account actions are still reachable, each at least 44px on a side
- [ ] `pnpm e2e responsive.spec.ts` passes, and was seen red before the fix
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass

## Comments

Found by ticket 07's build, not by a report from use: `board.spec.ts` was green
while `responsive.spec.ts` was not, and 07 confirmed the failure red on `main`
at 9cbb92c with its own branch stashed, so it is 18's and not 07's. Carried
forward in `docs/TRACKER.md` with the trigger "now".
