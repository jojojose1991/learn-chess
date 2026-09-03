import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import * as accounts from "./service"

import type { NewAccess, NewCoach, NewPassword } from "./rules"

// From `./rules`, never from `./service`: a re-export here survives into the
// client bundle, so re-exporting through the service module would put
// better-auth's server half and drizzle in the browser.
export { MIN_PASSWORD } from "./rules"

/** Validated input and the request's own headers, straight to `./service`. */

export const fetchAccounts = createServerFn({ method: "POST" }).handler(() =>
  accounts.listAccounts(getRequestHeaders())
)

export const addCoach = createServerFn({ method: "POST" })
  .validator((data: NewCoach) => data)
  .handler(({ data }) => accounts.createCoach(data, getRequestHeaders()))

export const setCoachPassword = createServerFn({ method: "POST" })
  .validator((data: NewPassword) => data)
  .handler(({ data }) => accounts.resetCoachPassword(data, getRequestHeaders()))

export const setAccess = createServerFn({ method: "POST" })
  .validator((data: NewAccess) => data)
  .handler(({ data }) => accounts.setAccess(data, getRequestHeaders()))
