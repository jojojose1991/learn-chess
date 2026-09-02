# 11 — Puzzle Links

**What to build:** How a Coach gets a Puzzle to a Student. From a saved Puzzle
they mint a short unlisted URL, stamped with the board theme they teach on so
the Student sees the same board. Opening it lands straight on Play — no
sign-in, no library, no navigation, no editing. The Coach can revoke it.

**Blocked by:** 10 (Solved / Not this time).

**Status:** ready-for-agent

- [ ] Minting produces an 8-character unlisted slug for one Puzzle, and the Coach can copy it
- [ ] Opening the link in a browser with no session lands directly on Play with that Puzzle
- [ ] The Student sees no sign-in prompt, no Library, no navigation and no way to edit the Position
- [ ] The board theme is the one stamped on the link, not the viewer's or a default
- [ ] Changing the Coach's theme afterwards does not change an already-minted link
- [ ] Revoking the link makes it refuse politely, and it stays refused
- [ ] An unknown slug is refused the same way, revealing nothing about which Puzzles exist
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass
