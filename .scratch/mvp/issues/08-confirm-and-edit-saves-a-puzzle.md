# 08 — Confirm & Edit, saving a Puzzle to the Library

**What to build:** The by-hand setup tool, which is the same screen that will
later confirm a Scan. From New Puzzle a Coach starts with an empty board,
places pieces, says whose turn it is, sets the Goal to mate in N, and saves it
under a name. It appears in their Library.

The validity check is visible and blocking: while the Position is illegal, play
and save are refused and the reasons are on screen. Authoring a Puzzle is
picking a Goal type and a number — a Coach never enters moves.

**Blocked by:** 07 (tap-tap moves), 05 (Library) and 02 (Goal evaluation).

**Status:** ready-for-agent

- [ ] New Puzzle offers starting from an empty board and reaches this screen
- [ ] Pieces can be placed and removed by tapping, with no dragging
- [ ] A flip button changes perspective; a White/Black toggle sets the side to move
- [ ] The Goal is mate in N, with N entered by the person
- [ ] An illegal Position shows its reasons and blocks both play and save
- [ ] A legal Position saves with a name and appears in the Library
- [ ] Reopening a saved Puzzle shows the same Position, side to move and Goal
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
