import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/sign-in")({ component: SignIn })

/**
 * One message for a wrong password and for an email that was never invited:
 * which of the two it was is not the signed-out visitor's business.
 */
const SIGN_IN_FAILED = "That email and password do not match."

function SignIn() {
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError(undefined)

    const attempt = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    })

    if (attempt.error) {
      setError(SIGN_IN_FAILED)
      setBusy(false)
      return
    }

    await router.invalidate()
    await navigate({ to: "/" })
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center p-6">
      <h1 className="font-heading text-2xl font-medium">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Coaches only. Accounts are invite-only.
      </p>

      {/*
        `method="post"` so a submit before React hydrates fails instead of
        putting the password in the query string (docs/learnings/testing.md).

        ponytail: the real fix is a server action, so sign-in works with no JS
        at all. Worth it when a Coach on a slow connection complains.
      */}
      <form
        method="post"
        onSubmit={submit}
        className="mt-6 flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  )
}
