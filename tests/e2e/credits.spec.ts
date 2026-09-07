import { expect, test } from "@playwright/test"

import { signIn } from "./coach"

/**
 * The piece artwork's attribution is a licence obligation, so the notice being
 * on a page a visitor can reach is the behaviour — not the markup that renders
 * it. `/credits` is public: a Student on a Puzzle Link has no sign-in.
 */

test("names the licence election, which is what makes the choice defensible", async ({
  page,
}) => {
  await page.goto("/credits")

  await expect(
    page.getByText("used here under the BSD 3-clause license", { exact: false })
  ).toBeVisible()
  await expect(page.getByText("Colin M.L. Burnett")).toBeVisible()
  await expect(
    page.getByRole("link", { name: "BSD 3-clause licence text" })
  ).toHaveAttribute("href", "/pieces/LICENSE.txt")
})

test("serves the full licence text alongside the art", async ({ request }) => {
  const licence = await request.get("/pieces/LICENSE.txt")

  expect(licence.ok()).toBe(true)
  expect(await licence.text()).toContain(
    "Redistribution and use in source and binary forms"
  )
})

test("is reachable from the app, so the credit is not an orphaned URL", async ({
  page,
}) => {
  await signIn(page)

  await page.getByRole("link", { name: "Credits" }).click()

  await expect(page.getByRole("heading", { name: "Credits" })).toBeVisible()
})
