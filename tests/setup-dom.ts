import { cleanup } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"

// `globals` is off, so React Testing Library's own auto-cleanup never runs —
// without this, one test's DOM is still mounted when the next one queries it.
afterEach(cleanup)
