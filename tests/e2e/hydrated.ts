import type { Page } from "@playwright/test"

/**
 * Wait until React has wired up the element `selector` matches. Playwright's
 * actionability checks do not imply hydrated, and a click on inert HTML fires
 * a native form submit (docs/learnings/testing.md). React's own `__react…`
 * key is the only signal that this element in particular is live.
 */
export function hydrated(page: Page, selector: string) {
  return page.waitForFunction((sel) => {
    const el = document.querySelector(sel)
    return !!el && Object.keys(el).some((k) => k.startsWith("__react"))
  }, selector)
}
