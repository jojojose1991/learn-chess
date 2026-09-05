import { expect, test } from "@playwright/test"

import { E2E_ADMIN } from "../../scripts/e2e-db"
import { signIn } from "./coach"
import { hydrated } from "./hydrated"

import type { Page } from "@playwright/test"

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
  // Scoped to the list: the email also appears in a screen-reader label on
  // the set-password field, and "is this Coach listed" is the behaviour here.
  await expect(
    page
      .getByRole("list", { name: "Accounts" })
      .getByText(E2E_ADMIN.email, { exact: true })
  ).toBeVisible()
})

/**
 * The photo is decorative, so it is a CSS background rather than an `<img>`:
 * a hidden `<img>` is fetched anyway, and the phone paying 136KB for a photo
 * it never shows is the whole reason for the indirection.
 */
test.describe("the photo beside the form", () => {
  async function photoRequests(page: Page) {
    const requested: string[] = []
    page.on("request", (request) => {
      if (request.url().endsWith("/sign-in.jpg")) requested.push(request.url())
    })
    await page.goto("/sign-in")
    await hydrated(page, "form")
    return requested
  }

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 800 } })

    test("is never downloaded, because it is never shown", async ({ page }) => {
      expect(await photoRequests(page)).toHaveLength(0)
    })
  })

  test.describe("on a wide screen", () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test("is downloaded, because it is shown", async ({ page }) => {
      expect(await photoRequests(page)).toHaveLength(1)
    })
  })
})
