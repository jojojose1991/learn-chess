import type { Locator, Page } from "@playwright/test"

/**
 * The names the board renders, in one place. A rename in the app is a red
 * suite and a one-line edit here, rather than a hunt through every spec that
 * happens to look at a board.
 */

export const boardOf = (page: Page) =>
  page.getByRole("group", { name: "Chess board" })

/** The tray of pieces to place, which only Confirm & Edit shows. */
export const trayOf = (page: Page) =>
  page.getByRole("group", { name: "Piece to place" })

/** The moves played so far, which only Play shows. */
export const movesOf = (page: Page) => page.getByRole("list", { name: "Moves" })

/** The board theme controls, which live in the sidebar and never on a screen. */
export const themesOf = (page: Page) =>
  page.getByRole("group", { name: "Board theme" })

/**
 * A square by its coordinate, whatever stands on it: the label carries the
 * piece too, so "a1" matches "a1, white rook" and "a1, empty" alike.
 */
export const square = (board: Locator, name: string) =>
  board.getByRole("button", { name: new RegExp(`^${name}(,|$)`) })

/**
 * A square by its whole label, piece included. Separate from `square` on
 * purpose — asserting the artwork on a1 means naming what is on a1, and a
 * prefix match would pass with the wrong piece there.
 */
export const squareExactly = (board: Locator, name: string) =>
  board.getByRole("button", { name, exact: true })
