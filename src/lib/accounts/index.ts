import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import * as accounts from "./service"

export { MIN_PASSWORD } from "./service"
export type { Account } from "./service"

/**
 * The accounts screen's server functions. Each one reads the request's own
 * headers and hands them to the service with its validated input — the rules
 * about who may do this, what a password has to be and what a row is called
 * all live in `./service`.
 */

export const fetchAccounts = createServerFn({ method: "POST" }).handler(() =>
  accounts.listAccounts(getRequestHeaders())
)

export const addCoach = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { email: string; name: string; password: string }) => data
  )
  .handler(({ data }) => accounts.createCoach(data, getRequestHeaders()))

export const setCoachPassword = createServerFn({ method: "POST" })
  .inputValidator((data: { coachId: string; password: string }) => data)
  .handler(({ data }) => accounts.resetCoachPassword(data, getRequestHeaders()))

export const setAccess = createServerFn({ method: "POST" })
  .inputValidator((data: { coachId: string; revoked: boolean }) => data)
  .handler(({ data }) => accounts.setAccess(data, getRequestHeaders()))
