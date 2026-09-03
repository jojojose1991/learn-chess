import { expect, test } from "@playwright/test"

import { signIn } from "./coach"

/**
 * The sidebar is every Coach screen's navigation, so it is tested here rather
 * than inside the spec of whichever screen happens to render underneath it.
 */

test("reaches the New Puzzle screen", async ({ page }) => {
  await signIn(page)

  await page.getByRole("link", { name: "New Puzzle" }).click()

  await expect(page.getByRole("heading", { name: "New Puzzle" })).toBeVisible()
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 800 } })

  test("closes the drawer on arriving, so it does not cover the screen", async ({
    page,
  }) => {
    await signIn(page)

    await page.getByRole("button", { name: "Toggle Sidebar" }).click()
    await page.getByRole("link", { name: "New Puzzle" }).click()

    await expect(
      page.getByRole("heading", { name: "New Puzzle" })
    ).toBeVisible()
    // The drawer is a modal: left open it `aria-hidden`s the screen behind it,
    // so a screen reader would be left with nothing but the sidebar.
    await expect(page.getByRole("dialog")).toBeHidden()
  })
})
