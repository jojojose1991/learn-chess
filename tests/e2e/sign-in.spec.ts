import { expect, test } from "@playwright/test"

import { E2E_ADMIN } from "../../scripts/e2e-db"
import { signIn } from "./coach"
import { hydrated } from "./hydrated"

/**
 * The one journey nothing else can cover: a real cookie, set by a real server,
 * surviving a real navigation. Every layer under this is already unit-tested,
 * and none of them prove a Coach can actually get in.
 */
test("a Coach signs in and lands on their Library", async ({ page }) => {
  await page.goto("/sign-in")
  await hydrated(page, "form")

  await page.getByLabel("Email").fill(E2E_ADMIN.email)
  await page.getByLabel("Password").fill(E2E_ADMIN.password)
  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible()
  await expect(page.getByText(`Signed in as ${E2E_ADMIN.email}`)).toBeVisible()
})

test("a wrong password says so without saying which half was wrong", async ({
  page,
}) => {
  await page.goto("/sign-in")
  await hydrated(page, "form")

  await page.getByLabel("Email").fill(E2E_ADMIN.email)
  await page.getByLabel("Password").fill("not-the-password")
  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(page.getByRole("alert")).toHaveText(
    "That email and password do not match."
  )
  await expect(page).toHaveURL(/\/sign-in$/)
})

/** The admin's screen, and the only one a Coach can be refused. */
test("the seeded admin can reach Accounts", async ({ page }) => {
  await signIn(page)

  await page.getByRole("link", { name: "Accounts" }).click()

  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible()
  // Scoped to the table: the email also appears in a screen-reader label on
  // the set-password field, and "is this Coach listed" is the behaviour here.
  await expect(
    page.getByRole("table").getByText(E2E_ADMIN.email, { exact: true })
  ).toBeVisible()
})
