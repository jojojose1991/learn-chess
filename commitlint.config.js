/**
 * Enforced by `.githooks/commit-msg`, so it binds an agent as much as a
 * person — which is the point.
 *
 * The two 72s are the industry 50/72 rule, not preferences: `git log
 * --oneline` prefixes an 8-character hash and `git log` indents bodies by 4,
 * so both land on an 80-column terminal. GitHub warns past 50 and truncates
 * a subject past 72. Note this is stricter than config-conventional, which
 * defaults both to 100.
 *
 * `body-max-length` is a **deliberate deviation**. commitlint defaults it to
 * Infinity, real-world configs disable it, and the convention holds that the
 * body is exactly where a thorough "why" belongs — all of which was written
 * for human authors, who under-write because prose is tedious. An agent has
 * the opposite bias: it finishes a long reasoning process and pastes it. The
 * bloat is line *count*, for which commitlint has no rule, so a total cap is
 * the available proxy.
 *
 * 600 measured against this repo: outcome-focused bodies run 192-334
 * characters and bloated ones start at 827. It only works because durable
 * knowledge is routed to docs/ rather than squeezed out.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 72],
    "body-max-line-length": [2, "always", 72],
    "body-max-length": [2, "always", 600],
  },
}
