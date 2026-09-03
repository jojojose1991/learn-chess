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
      <h1 className="font-heading text-2xl font-medium">Accounts</h1>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="pb-2 font-medium">Coach</th>
            <th className="pb-2 font-medium">Puzzles</th>
            <th className="pb-2 font-medium">Access</th>
            <th className="pb-2 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.id} className="border-b align-middle">
              <td className="py-3 pr-4">
                <div>{account.name}</div>
                <div className="text-muted-foreground">{account.email}</div>
              </td>
              <td className="py-3 pr-4 tabular-nums">{account.puzzles}</td>
              <td className="py-3 pr-4">
                {account.revoked ? "Revoked" : "Active"}
              </td>
              <td className="py-3">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <form
                    onSubmit={(event) => submitPassword(event, account.id)}
                    className="flex items-center gap-2"
                  >
                    <Label
                      htmlFor={`password-${account.id}`}
                      className="sr-only"
                    >
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
                      className="w-52"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
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
                      size="sm"
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-medium">Add a Coach</h2>
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
