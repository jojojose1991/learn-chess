import { useState } from "react"
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  MIN_PASSWORD,
  addCoach,
  fetchAccounts,
  setAccess,
  setCoachPassword,
} from "@/lib/accounts"

export const Route = createFileRoute("/_coach/admin")({
  loader: async () => {
    const accounts = await fetchAccounts()
    // A Coach who is not an admin gets no screen at all, rather than one that
    // exists and refuses.
    if (!accounts) throw notFound()
    return accounts
  },
  component: Accounts,
})

function Accounts() {
  const accounts = Route.useLoaderData()
  const { coach } = Route.useRouteContext()
  const router = useRouter()
  const navigate = Route.useNavigate()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  /** Runs one write, then refetches the list it just changed. */
  async function run(write: () => Promise<{ error?: string }>) {
    setBusy(true)
    setError(undefined)
    const failure = (await write()).error
    if (failure) setError(failure)
    else await router.invalidate()
    setBusy(false)
    return !failure
  }

  async function submitCoach(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const added = await run(() =>
      addCoach({
        data: {
          email: String(fields.get("email")),
          name: String(fields.get("name")),
          password: String(fields.get("password")),
        },
      })
    )
    if (added) form.reset()
  }

  async function submitPassword(
    event: React.FormEvent<HTMLFormElement>,
    coachId: string
  ) {
    event.preventDefault()
    const form = event.currentTarget
    const password = String(new FormData(form).get("password"))
    if (!(await run(() => setCoachPassword({ data: { coachId, password } }))))
      return
    form.reset()
    // A new password ends every session that Coach had, and when the Coach is
    // you that includes this one. Say where you are going rather than letting
    // the next request bounce you there.
    if (coachId === coach.id) await navigate({ to: "/sign-in" })
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <h1 className="text-2xl">Accounts</h1>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* A list, not a table: a table lays out at its content's intrinsic
          width whatever `w-full` says, and four columns holding an email and
          a password form are wider than a phone. `role` for the reason in
          `_coach/index.tsx`. */}
      <ul
        role="list"
        aria-label="Accounts"
        className="flex flex-col divide-y border-y text-sm"
      >
        {accounts.map((account) => (
          <li
            key={account.id}
            className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="min-w-0 sm:flex-1">
              <div>{account.name}</div>
              <div className="break-all text-muted-foreground">
                {account.email}
              </div>
            </div>
            <p className="text-muted-foreground sm:w-40 sm:shrink-0">
              {account.puzzles} {account.puzzles === 1 ? "Puzzle" : "Puzzles"}
              {" · "}
              {account.revoked ? "Revoked" : "Active"}
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <form
                onSubmit={(event) => submitPassword(event, account.id)}
                className="flex w-full items-center gap-2 sm:w-auto"
              >
                <Label htmlFor={`password-${account.id}`} className="sr-only">
                  New password for {account.email}
                </Label>
                <Input
                  id={`password-${account.id}`}
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={
                    account.id === coach.id
                      ? "New password — signs you out"
                      : "New password"
                  }
                  minLength={MIN_PASSWORD}
                  required
                  className="min-h-11 sm:w-52"
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="min-h-11"
                  disabled={busy}
                >
                  Set
                </Button>
              </form>

              {account.id === coach.id ? (
                <span className="text-muted-foreground">This is you</span>
              ) : (
                <Button
                  variant={account.revoked ? "outline" : "ghost"}
                  className="min-h-11"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      setAccess({
                        data: {
                          coachId: account.id,
                          revoked: !account.revoked,
                        },
                      })
                    )
                  }
                >
                  {account.revoked ? "Restore" : "Revoke"}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg">Add a Coach</h2>
        <form
          onSubmit={submitCoach}
          className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-email">Email</Label>
            <Input id="new-email" name="email" type="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-name">Name</Label>
            <Input id="new-name" name="name" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">Initial password</Label>
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              required
            />
          </div>
          <Button type="submit" disabled={busy}>
            Add
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">
          Accounts are never deleted. Revoking ends every session and stops
          sign-in; the Coach&rsquo;s Library and Puzzle Links stay put.
        </p>
      </section>
    </main>
  )
}
