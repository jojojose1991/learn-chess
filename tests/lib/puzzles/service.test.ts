import { describe, expect, it } from "vitest"

import { GOAL_N_MAX, NAME_MAX } from "@/lib/puzzles/rules"
import { draftRefusal } from "@/lib/puzzles/service"

import type { PuzzleDraft } from "@/lib/puzzles/rules"

/** White plays Qg7 mate; Black is not already in check, so it is legal too. */
const MATE_IN_ONE = "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1"

const draft = (over: Partial<PuzzleDraft> = {}): PuzzleDraft => ({
  name: "Back rank mate",
  fen: MATE_IN_ONE,
  goal: { kind: "mate_in", n: 1 },
  ...over,
})

/**
 * The screen refuses the same three things, but a screen is only the polite
 * half: the server function's `validator` is a type annotation and strips
 * nothing at runtime, so a request that never met the form gets here whole.
 */
describe("what a Puzzle has to be before it is saved", () => {
  it("takes a legal Position with a name and a Goal", () => {
    expect(draftRefusal(draft())).toBeNull()
  })

  it("refuses an illegal Position in the words the Coach was already reading", () => {
    expect(draftRefusal(draft({ fen: "8/8/8/8/8/8/8/8 w - - 0 1" }))).toBe(
      "White has no king."
    )
  })

  it("refuses a blank name, because a Library of unnamed rows is not a Library", () => {
    expect(draftRefusal(draft({ name: "   " }))).toBe("A Puzzle needs a name.")
  })

  it("refuses a name past what the field allows, so nothing outgrows the row it lists in", () => {
    expect(draftRefusal(draft({ name: "x".repeat(NAME_MAX + 1) }))).toBe(
      `A name can be at most ${NAME_MAX} characters.`
    )
  })

  it("refuses a mate in no moves at all, and a mate further off than the Goal goes", () => {
    const outOfRange = `Mate in has to be a whole number from 1 to ${GOAL_N_MAX}.`

    expect(draftRefusal(draft({ goal: { kind: "mate_in", n: 0 } }))).toBe(
      outOfRange
    )
    expect(
      draftRefusal(draft({ goal: { kind: "mate_in", n: GOAL_N_MAX + 1 } }))
    ).toBe(outOfRange)
    expect(draftRefusal(draft({ goal: { kind: "mate_in", n: 1.5 } }))).toBe(
      outOfRange
    )
  })

  it("refuses a body that is not a draft at all, rather than throwing on the way in", () => {
    const notADraft = (over: unknown) => over as PuzzleDraft
    const shapeless = "That is not a Puzzle we can save."

    expect(draftRefusal(notADraft({}))).toBe(shapeless)
    expect(draftRefusal(notADraft({ ...draft(), name: 12 }))).toBe(shapeless)
    expect(draftRefusal(notADraft({ ...draft(), fen: null }))).toBe(shapeless)
    expect(draftRefusal(notADraft({ ...draft(), goal: null }))).toBe(shapeless)
  })

  it("refuses a Goal kind this product does not have, rather than storing one nothing can evaluate", () => {
    const goal = {
      kind: "win_material",
      n: 1,
    } as unknown as PuzzleDraft["goal"]

    expect(draftRefusal(draft({ goal }))).toBe("That is not a Goal we have.")
  })
})

/**
 * The search itself is `hasNoMateWithin`'s, and proved in
 * tests/lib/chess/goals.test.ts. What is left here is that Save is wired to
 * it, and in which direction: an unreachable Goal refuses, and a Goal the
 * search cannot reach does not.
 */
describe("a Goal has to be one the Position can actually reach", () => {
  /** A bare king each way: legal, playable, and mate is never coming. */
  const NO_MATE = "7k/8/5K2/8/8/8/8/8 w - - 0 1"

  it("refuses a Goal the Position cannot reach, so no unsolvable Puzzle is stored", () => {
    expect(
      draftRefusal(draft({ fen: NO_MATE, goal: { kind: "mate_in", n: 1 } }))
    ).toBe("There is no checkmate in 1 move in this position.")
  })

  it("takes a Goal the Position does reach", () => {
    expect(
      draftRefusal(draft({ fen: MATE_IN_ONE, goal: { kind: "mate_in", n: 1 } }))
    ).toBeNull()
  })

  // The Goal's number reaches GOAL_N_MAX and the search stops well below it:
  // past that the Coach's word stands, rather than a refusal nothing proved.
  it("takes a Goal too deep to search rather than calling it unsolvable", () => {
    expect(
      draftRefusal(
        draft({ fen: NO_MATE, goal: { kind: "mate_in", n: GOAL_N_MAX } })
      )
    ).toBeNull()
  })
})
