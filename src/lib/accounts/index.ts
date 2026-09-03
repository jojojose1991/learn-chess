import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import * as accounts from "./service"
import type { NewAccess, NewCoach, NewPassword } from "./service"

export { MIN_PASSWORD } from "./service"

/** Validated input and the request's own headers, straight to `./service`. */

export const fetchAccounts = createServerFn({ method: "POST" }).handler(() =>
  accounts.listAccounts(getRequestHeaders())
)

export const addCoach = createServerFn({ method: "POST" })
  .inputValidator((data: NewCoach) => data)
  .handler(({ data }) => accounts.createCoach(data, getRequestHeaders()))

export const setCoachPassword = createServerFn({ method: "POST" })
  .inputValidator((data: NewPassword) => data)
  .handler(({ data }) => accounts.resetCoachPassword(data, getRequestHeaders()))

export const setAccess = createServerFn({ method: "POST" })
  .inputValidator((data: NewAccess) => data)
  .handler(({ data }) => accounts.setAccess(data, getRequestHeaders()))
