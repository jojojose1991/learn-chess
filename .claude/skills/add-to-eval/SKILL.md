---
name: add-to-eval
description: Add a photograph of a chess board to the Scan eval set — copy it in, read the position off it with the user, write the expectation sidecar, confirm Git LFS took it, and offer to run the eval. Use when the user says /add-to-eval, or asks to add an image, photo, screenshot or scan to the eval, the bench, or the test images.
---

# Add a photograph to the Scan eval

`eval/README.md` has the field meanings. Edit this file as the process changes.

Argument: one path, several, or a directory. None given, ask.

1. **Copy** into `eval/images/book/` (printed diagram) or `field/` (anything a
   Coach sent, and everything awkward). Keep the camera's filename. Stop if one
   of that name is already there.

2. **Show them the board**, cropped readable, and state back the position for
   correction. Never write a label from a strategy's output — that scores the
   pipeline against itself.
   - `placement` — **as drawn**, top rank of the picture first, never rotated.
   - `orientation` — `white` when a1 is bottom-left as printed. The coordinate
     labels settle it; the pieces do not.
   - `sideToMove` — in the caption beside the diagram, not in the board.
     Usually `null` with `"sideToMoveFrom": "not in frame"`, which is the
     correct answer and not a gap.

   Ask about all three. Ask which board, if there are two.

3. **Sidecar** beside the image, same basename, `.json`, plus `notes`: what
   makes this one hard (roll, glare, shadow, page bow, clutter, two boards, a
   small board in a big frame).

4. **Confirm LFS took it** — `git add` both, then `git lfs ls-files | grep`.
   No line back means it went in as a git blob; fix `.gitattributes` and
   `git rm --cached` before committing.

5. **Run** `pnpm eval [set]`, ask which scope first. Report whether the new
   image moved anything — one that every reader gets right adds nothing, one
   that every reader fails is the interesting kind.

6. **Commit** image, sidecar and `eval/results/<date>.json` together. Push only
   if asked; `pre-push` uploads the LFS objects and is slow.

## Do not

- Convert, crop, rotate, downscale or re-encode the photograph. The eval
  measures what a real upload does. Preparation belongs inside a strategy.
- Convert HEIC. `src/lib/scan/service.ts` decodes PNG and JPEG only, so an
  iPhone upload scoring zero is a finding about the pipeline. Keep it, label
  it, say so.
- Put it in `tests/fixtures/` (generated browser renderings), or wire the eval
  into `pnpm test` or CI.
