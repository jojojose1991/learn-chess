# The Scan eval

Real photographs of real boards, scored square by square against what a person
read off the page. It answers one question every few weeks: **is the Scan
pipeline getting better or worse at the pictures Coaches actually take?**

```bash
git lfs pull            # once per clone — the photographs are LFS objects
pnpm eval               # every set
pnpm eval book          # one set
```

## It is not part of CI, on purpose

`pnpm test` needs no database, no network and no fixtures beyond what a script
can draw. This needs megabytes of photographs, an ONNX session and about a
minute, and its output is a number to read rather than a threshold to break.
CI typechecks and lints this directory — `tsconfig.json` and `eslint.config.js`
both reach it, so the code stays honest — and never runs it. `actions/checkout`
leaves LFS alone unless asked, so CI does not even download the images, and
`.dockerignore` keeps them out of the deployed image.

## What is here

```
eval/
  run.ts             the runner: decode, score, report, record
  strategies.ts      the two ports and every implementation of each
  images/<set>/      photographs (LFS) and their expectations (plain JSON)
  results/<date>.json  one file per run, committed, so the trend is readable
```

Sets are just directories. `book/` is photographs of printed puzzle books;
`field/` is what Coaches send in, which is where the hard ones will be.

## The two ports

`strategies.ts` says why there are two of them.

- A **Reader** takes a photograph and returns a placement. `full` is what
  ships; `s500` is that shrunk to a 500 px long edge; `c500` adds a contrast
  stretch; `vote` keeps the placement the most rungs of the ladder agree on.
- A **Sider** takes a placement and returns the side the board was drawn from.
  `pawns` is what ships. `kings` is the candidate.

Add one by adding it to the array in `strategies.ts`. Nothing else changes —
the runner scores whatever is in there, and `results/` records it by name, so
a strategy's history survives its author losing interest in it.

## Expectations

Every photograph has a JSON file of the same name beside it:

```json
{
  "placement": "8/4q3/3k4/8/3KP3/4N3/8/8",
  "orientation": "white",
  "sideToMove": null,
  "sideToMoveFrom": "not in frame",
  "notes": "Two boards in frame; this expects the lower one."
}
```

- `placement` — the FEN placement field **as drawn**, never rotated. Ranks run
  from the top of the picture down, so this is what a reader should return
  before any orientation is applied.
- `orientation` — `white` when a1 is bottom-left as printed, `black` when the
  board is drawn from the other side.
- `sideToMove` — `w`, `b`, or **`null`**, which is the usual answer.
- `sideToMoveFrom` — where the human got it: `"caption"`, `"not in frame"`,
  `"the Coach said"`. Provenance, so nobody later mistakes a convention for a
  measurement.

**Nothing scores against `sideToMove`, and that is the point.** A book prints
"White to play and mate in two" in the caption beside the diagram, not inside
it. No reader can recover what is not in the pixels, so the eval records the
gap rather than pretending to close it. Side to move comes from the caption or
from the Coach.

**Never fill an expectation in from a strategy's output.** The whole value of
the file is that it was read by a person who could see the page. A truth copied
from the pipeline scores the pipeline against itself and always passes.

## Adding a photograph

`/add-to-eval <path>` walks it, and
`.claude/skills/add-to-eval/SKILL.md` is that process, to be edited as it
changes.

By hand it is: drop the image in `eval/images/<set>/`, write the sidecar beside
it, `git add`, confirm `git lfs ls-files` lists it, run `pnpm eval`, commit the
image, the sidecar and the new `results/` file together.

## Git LFS

`brew install git-lfs` (or the distro equivalent) before `pnpm install`, which
wires its hooks in through `pnpm prepare`. Without it a clone gets pointer
files where the photographs should be.

## Photographs are somebody's

`field/` will hold pictures taken by Coaches of pages from books they bought.
Committing one publishes it for the life of the repository. Keep the set small
and representative rather than complete, take out anything with a face, a name
or a room in it, and if the repository ever goes public, this directory is the
first thing to check.
