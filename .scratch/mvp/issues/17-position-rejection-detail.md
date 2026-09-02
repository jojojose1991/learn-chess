# 17 — Does a rejected Position need to say more than one sentence?

**What to verify:** `validatePosition` maps five of `validateFen`'s errors to
sentences a Coach can act on — the king counts and pawns on the edge rows —
and collapses every other one to a single `"That is not a legal position."`
The detail `chess.js` offered is discarded, so a bad castling field, a
malformed en-passant square, a broken half-move counter and outright gibberish
are indistinguishable to whoever is looking at the screen.

That was a deliberate call in ticket 01, on two grounds: the remaining strings
are jargon (`castling availability is invalid`, `half move counter number must
be a non-negative integer`) that no Student and few Coaches would read as
help, and in the MVP every Position is built by our own board editor, which
cannot produce those shapes.

Scan is what changes the premise. A Position derived from an image is the first
one we did not construct ourselves, and if the classifier can emit a placement
that trips one of the unmapped errors, the person is told only that something
is wrong and not what. Worth an actual look once Scan is running against real
photos: if the unmapped errors never fire, close this and keep the one
sentence. If they do, they need Coach-readable wording, not the library's.

**Blocked by:** 14 — scan a screenshot. Nothing to verify until a Position
arrives from outside our own editor.

**Status:** needs-triage

- [ ] Determine whether Scan can produce a Position that fails `validateFen`
      with any error `structuralReasons` does not map
- [ ] If it can, give each reachable error a sentence in the register of the
      other five — no notation, no library vocabulary
- [ ] If it cannot, close this and leave the single sentence in place

## Comments

Raised out of ticket 01's code review rather than a report from use — no one
has hit it. See `src/lib/chess/rules.ts` (`structuralReasons`) and
`docs/learnings/chess-libraries.md` for the full list of 1.4.0 error strings.
