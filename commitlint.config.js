/**
 * Enforced by `.githooks/commit-msg`, so it applies to an agent's commits as
 * much as a person's — which is the point.
 *
 * `body-max-length` is the rule that matters: commitlint has none for body
 * *line count*, and every over-long message this repo has produced wrapped
 * correctly at 72 with a valid subject. 400 characters is about five lines.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 72],
    "body-max-line-length": [2, "always", 72],
    "body-max-length": [2, "always", 400],
  },
}
