import { readdirSync, statSync } from "node:fs"
import { extname, join, relative } from "node:path"

import { expect, it } from "vitest"

/**
 * srvx serves `dist/client` in the container and cannot serve a file whose
 * name has no extension, so one in `public/` is shipped and then unreachable —
 * `public/pieces/LICENSE` 404'd on the deployed service while every `.svg`
 * beside it served. The mechanism is in `docs/learnings/deployment.md`.
 *
 * Asserted over the directory rather than in `tests/e2e/`, where the licence
 * obligation was already written: `pnpm e2e` runs `vite dev`, which serves an
 * extensionless file 200, so those three tests pass with the bug present —
 * measured, on the pre-fix tree. Only the production server disagrees, and the
 * rule it imposes is a property of the directory.
 */

const PUBLIC_DIR = new URL("../public", import.meta.url).pathname

it("gives every public file an extension, because srvx cannot serve one without", () => {
  expect(extensionless(PUBLIC_DIR)).toEqual([])
})

/** Every file under `dir`, recursively, whose name carries no extension. */
function extensionless(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return extensionless(path)
    return extname(entry) === "" ? [relative(PUBLIC_DIR, path)] : []
  })
}
