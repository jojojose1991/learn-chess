import { E2E_ADMIN } from "../../scripts/e2e-db"
import { hydrated } from "./hydrated"

import type { Page } from "@playwright/test"

/**
 * Signed in and on the Library. Sign-in itself is the subject of
 * `sign-in.spec.ts`; everywhere else it is setup.
 */
export async function signIn(page: Page) {
  await page.goto("/sign-in")
  await hydrated(page, "form")
  await page.getByLabel("Email").fill(E2E_ADMIN.email)
  await page.getByLabel("Password").fill(E2E_ADMIN.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.getByRole("heading", { name: "Library" }).waitFor()
}
