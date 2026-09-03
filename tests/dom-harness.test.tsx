import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

/** Checks the jsdom project, jest-dom's matchers and `cleanup` are wired. */
describe("the dom test harness", () => {
  it("renders into a document and matches on what is visible", () => {
    render(<button type="button">Tap</button>)
    expect(screen.getByRole("button", { name: "Tap" })).toBeVisible()
  })

  it("starts the next test with an empty document", () => {
    expect(
      screen.queryByRole("button", { name: "Tap" })
    ).not.toBeInTheDocument()
  })
})
