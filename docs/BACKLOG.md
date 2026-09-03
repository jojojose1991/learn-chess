# Backlog

Deliberately deferred during design. Each line says what it is and what has to
stay true in the MVP so it can be added without a rewrite.

Nothing here is owed. A shortcut taken during a build, or a review finding not
taken, is a debt rather than a choice, and lives in `docs/TRACKER.md` under
Carried forward — with the trigger that makes it live again. Do not merge the
two lists.

## Goals

- **Win-material Goals** ("win a piece worth ≥ V within N moves"). Requires the
  Goal to stay a predicate over board state, never a stored solution line.
- **Reading the Goal from the image.** One sample image had "Mate in 1 move."
  printed above the board. OCR of caption text is a second recognition problem;
  the person types N for now.

## Students and homework

- **Student Profiles** — Coach-owned names, no credentials. New table.
- **Attempt recording** — outcome, SAN move list, timestamps, one row per try.
  New table plus a nullable link from a share link to a Student Profile.
- **Coach visibility of the moves played**, not just pass/fail. The teaching
  signal is *which* wrong idea the child had.
- **Assignment links** — a named set of Puzzles bound to one Student Profile,
  one slug, so Attempts attribute with no roster on screen.
- **Parent-held Student accounts** for a guided journey.

## Auth

- **Password reset via Resend.** Blocked on a verified domain; Resend's sandbox
  sender only delivers to the account owner. MVP: the Admin sets passwords by
  hand on the Accounts screen, so a Coach who is locked out asks them. That
  screen is the stand-in, not the feature — self-service reset is still out.
- **Public Coach signup**, email verification, rate limits. MVP is invite-only.

## Feel

- **Sound.** Three cues — place, capture, solve — behind a remembered mute
  toggle. Cut from the MVP entirely.
- **Animation.** Pieces sliding to their square, captured pieces fading, the
  legal-square dots springing in, and a solve celebration. Cut from the MVP;
  pieces move instantly and the solved state is static.

## Play

- **A deliberately weak opponent** for free play. Stockfish cannot go below
  1320 Elo, so this needs a hand-rolled mover (random / greedy on `chess.js`),
  not an engine setting.

## Scan

- **Automatic corner detection** for photos. MVP drags four handles by hand;
  measured tolerance is ~±10% of a tile, so a zoom loupe is required either
  way. `jscanify` would do it but costs ~8 MB of OpenCV.js.

## Sharing

- **OG preview image** of the board so a shared link unfurls in WhatsApp.
  TanStack Start's SSR makes this one route.

## Library

- **Folders or tags.** MVP is a flat list with a name field.

## Ops

- **Staging environment.** MVP is prod only.
