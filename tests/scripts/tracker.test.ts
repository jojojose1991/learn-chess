import { describe, expect, it } from "vitest"

import {
  parseBlockers,
  parseTicket,
  renderCount,
  renderTable,
  writeRegion,
} from "../../scripts/tracker"

import type { Ticket } from "../../scripts/tracker"

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  number: "11",
  title: "Puzzle Links",
  status: "ready-for-agent",
  blockedBy: [],
  ...over,
})

describe("reading a ticket", () => {
  it("takes the title from the heading, so there is no short name to keep in step", () => {
    const read = parseTicket(
      "# 21 — A Library row says what the Puzzle is\n\n**Status:** resolved\n"
    )

    expect(read).toMatchObject({
      number: "21",
      title: "A Library row says what the Puzzle is",
      status: "resolved",
    })
  })

  it("refuses a status that is not one of the labels, rather than inventing a row", () => {
    expect(() => parseTicket("# 07 — A ticket\n\n**Status:** done\n")).toThrow(
      /Status/
    )
  })

  it("reads the blockers out of the first sentence", () => {
    expect(
      parseBlockers(
        "**Blocked by:** 08 (Confirm & Edit) and 02 (illegal-move explanations)."
      )
    ).toEqual(["08", "02"])
  })

  it("does not read a ticket named while saying there are no blockers", () => {
    // Three tickets are written this way, and a plain search for two digits
    // reports each of them blocked by the ticket they say they do not wait for.
    expect(
      parseBlockers(
        "**Blocked by:** nothing. 06 resolved, so both themes are on screen."
      )
    ).toEqual([])
  })

  it("keeps reading past a line break, because the sentence wraps", () => {
    expect(
      parseBlockers(
        "**Blocked by:** 14 — scan a screenshot. Nothing to verify until a\nPosition arrives from an image."
      )
    ).toEqual(["14"])
  })
})

describe("the table", () => {
  it("calls a ticket ready only when every ticket it waits on is resolved", () => {
    const table = renderTable([
      ticket({ number: "10", title: "Solved", status: "resolved" }),
      ticket({ number: "11", blockedBy: ["10"] }),
      ticket({ number: "16", title: "Deploy", blockedBy: ["11"] }),
    ])

    expect(table).toContain("| 11 | Puzzle Links | 🟢 **ready** | 10 ✅ |")
    expect(table).toContain("| 16 | Deploy | ⬜ ready-for-agent | 11 |")
  })

  it("marks which of a blocked ticket's blockers are already done", () => {
    const table = renderTable([
      ticket({ number: "12", title: "Engine", status: "resolved" }),
      ticket({ number: "13", title: "Defends", blockedBy: ["10", "12"] }),
    ])

    expect(table).toContain("| 13 | Defends | ⬜ ready-for-agent | 10, 12 ✅ |")
  })

  it("puts what is done first and what can be picked up next", () => {
    const numbers = renderTable([
      ticket({ number: "16", title: "Deploy", blockedBy: ["99"] }),
      ticket({ number: "11", blockedBy: [] }),
      ticket({ number: "09", title: "Play", status: "resolved" }),
    ])
      .split("\n")
      .slice(2)
      .map((row) => row.split(" | ")[0].replace("| ", ""))

    expect(numbers).toEqual(["09", "11", "16"])
  })
})

describe("the count", () => {
  it("names the tickets someone could pick up this minute", () => {
    expect(
      renderCount([
        ticket({ number: "09", title: "Play", status: "resolved" }),
        ticket({ number: "11", blockedBy: ["09"] }),
        ticket({ number: "13", title: "Defends", blockedBy: ["09"] }),
        ticket({ number: "16", title: "Deploy", blockedBy: ["13"] }),
      ])
    ).toBe(
      "**1 of 4 resolved. Two tickets are actionable right now: 11 and 13.**"
    )
  })

  it("says so when everything left is waiting on something", () => {
    expect(
      renderCount([ticket({ number: "16", blockedBy: ["13"] })])
    ).toContain("Nothing is actionable yet.")
  })
})

describe("writing the file", () => {
  it("replaces a region and leaves the rest of the file alone", () => {
    const before =
      "# Tracker\n\n<!-- tracker:count -->\nold\n<!-- /tracker:count -->\n\n## Carried forward\n"

    expect(writeRegion(before, "count", "new")).toBe(
      "# Tracker\n\n<!-- tracker:count -->\nnew\n<!-- /tracker:count -->\n\n## Carried forward\n"
    )
  })

  it("refuses a file whose markers are gone, rather than writing nothing", () => {
    expect(() => writeRegion("# Tracker\n", "count", "new")).toThrow(/region/)
  })
})
