import { cleanup } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"

// `globals` is off, so React Testing Library's own auto-cleanup never runs —
// without this, one test's DOM is still mounted when the next one queries it.
afterEach(cleanup)

// jsdom 28 ships `<dialog>` but not its modal half, so the promotion picker
// cannot open in a unit test. The shim is the markup, not the behaviour: the
// focus trap, Escape and focus restore are the browser's and are asserted in
// `tests/e2e/board.spec.ts` instead.
// Assigned outright rather than conditionally: the DOM types say both methods
// exist, so a guard is unreachable code to `typescript-eslint`.
HTMLDialogElement.prototype.showModal = function showModal(
  this: HTMLDialogElement
) {
  this.open = true
}
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.open = false
  this.dispatchEvent(new Event("close"))
}
