# 27 — `issue-files.md` counts the tickets, and gets it wrong

**What to build:** A doc that does not carry a number it cannot keep.
`docs/agents/issue-files.md:30` says `docs/TRACKER.md` "already indexes the 18
tickets in `.scratch/mvp/issues/`". There are 24, and there will be more —
this file is the one an agent reads to learn how tickets are filed, so a wrong
count there is wrong at the moment someone is trusting it.

Drop the count rather than correct it. A number in prose is a second copy of
something `pnpm tracker` already derives, and correcting it just resets the
clock on the same drift.

**Blocked by:** nothing.

**Status:** resolved

- [x] `docs/agents/issue-files.md` no longer states how many tickets exist
- [x] The sentence still points at `docs/TRACKER.md` as the index, which was its job
- [x] No other doc carries a hand-written ticket count
