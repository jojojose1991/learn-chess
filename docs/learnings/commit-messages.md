# Commit message limits: what is convention, and what is ours

Researched September 2026 because the numbers in `commitlint.config.js` looked
arbitrary. Two of the three are industry consensus with a concrete rationale.
The third is a deliberate local deviation, recorded here so nobody "fixes" it
back to the default.

## The 50/72 rule is real, and the numbers are not arbitrary

Traced to [tpope's 2008
post](https://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html),
restated as seven rules by [cbeams](https://cbea.ms/git-commit/), and endorsed
by `git help commit` itself ("a single short (less than 50 character) line
summarizing the change").

- **Body wrapped at 72.** `git log` never wraps text, and pads the body with 4
  spaces. On an 80-column terminal, 4 of indent plus 4 for symmetry leaves 72.
- **Subject around 50, hard limit 72.** cbeams is precise about the split:
  "shoot for 50 characters, but consider 72 the hard limit" — GitHub's UI
  warns past 50 and **truncates with an ellipsis past 72**. `git log
  --oneline` prefixes an 8-character hash, so 72 + 8 = 80 again.
- The Linux kernel's own guidance says 70–75, and kernel commits do not
  strictly obey 50 — the referenced example is 54.

So `header-max-length: 72` is the tightest number with a real justification
behind it, not a preference. 50 is the aspiration; 72 is where tooling breaks.

## We are stricter than the JS ecosystem

Worth knowing before assuming 72 is the default anywhere:

| Config | `header-max-length` | `body-max-line-length` |
| --- | --- | --- |
| `@commitlint/config-conventional` | 100 | 100 |
| `@commitlint/config-angular` | 72 | — |
| Weburz/commitlint-config | 72 | `Infinity` (warning only) |
| camunda/camunda | 120 | 120 |
| this repo | 72 | 72 |

The drift to 100/120 is real and defensible — GitHub soft-wraps bodies now.
We keep 72 because the `git log` rationale has not stopped being true.

## `body-max-length` has no consensus at all

This is the one to be careful about:

- commitlint's **default is `Infinity`**
  ([rules reference](https://commitlint.js.org/reference/rules.html)).
- camunda **explicitly disables it**: `'body-max-length': [0, 'always',
  Infinity]`.
- The only in-the-wild usage found was [a bug
  report](https://github.com/KeisukeYamashita/commitlint-rs/issues/416) from
  someone who set it to 72 assuming it capped each line.
- The convention runs the other way. tpope: "further paragraphs come after
  blank lines". The body is *where a thorough why belongs*.

**Why we deviate anyway.** That convention was written for human authors, who
under-write because prose is tedious. An agent has the inverse bias: it
finishes a long reasoning process and pastes the reasoning in. Measured on
this repo's own history, agent-written bodies split cleanly:

| Style | Body characters |
| --- | --- |
| Outcome-focused, bulleted | 192, 241, 272, 334 |
| Prose narration of the diff | 827, 944, 950, 960, 2325 |

The bloat is line *count*, and commitlint has no rule for it, so a total
character cap is the only available proxy. 600 sits in the empty gap between
334 and 827, and fits the three bullets AGENTS.md asks for — 400 did not, and
rejected two honest messages.

**The cost, stated plainly.** Capping the body can squeeze out reasoning the
convention would have kept. That is only acceptable because this repo routes
durable knowledge elsewhere: a deploy step to `docs/PLAN.md`, a library gotcha
to this directory, a rule to `AGENTS.md`. Remove that habit and the cap starts
destroying information.

## Not checked

Whether any large project caps total body length deliberately. Six searches
turned up none, but absence of evidence is weak here — most projects simply
never set the rule.
