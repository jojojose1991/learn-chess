//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"
import testingLibrary from "eslint-plugin-testing-library"

const behaviouralTests = {
  files: ["tests/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "CallExpression[callee.property.name=/^toMatch(Inline)?Snapshot$/]",
        message:
          "No snapshots. They fail on every class change and nobody reads the diff — assert the specific thing you care about.",
      },
      {
        selector: "CallExpression[callee.property.name='toHaveBeenCalled']",
        message:
          "`toHaveBeenCalled` asserts that a collaborator was reached, which is implementation. Assert the consequence a user could observe — or, if the callback IS the component's output contract, its arguments with `toHaveBeenCalledWith`.",
      },
      {
        selector:
          "MemberExpression[property.name=/^(get|query|find)(All)?ByTestId$/]",
        message:
          "Query by role and accessible name. If there is no accessible handle to grab, that is an accessibility bug to fix rather than route around.",
      },
    ],
  },
}

export default [
  ...tanstackConfig,
  {
    rules: {
      "import/no-cycle": "off",
      "import/order": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
    },
  },
  {
    ...testingLibrary.configs["flat/react"],
    files: ["tests/**/*.tsx"],
  },
  behaviouralTests,
  {
    ignores: [
      // Plain-JS config files: no `allowJs`, so they are not in the TS program.
      "eslint.config.js",
      "commitlint.config.js",
      ".prettierrc",
      "tests/e2e/**",
      // Playwright output: generated, and not in any tsconfig project.
      "test-results/**",
    ],
  },
]
