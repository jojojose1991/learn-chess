# Testing: what bit us, measured

Three gotchas found by building the suite, all of which passed `typecheck`,
`lint` and the whole unit suite before the e2e run caught them.

## A server-fn module's re-exports reach the client bundle

`tanstackStart()` replaces every `createServerFn(...).handler(...)` body with a
`createClientRpc(...)` stub, so the handler's imports vanish from the client
graph. It does **not** touch `export … from` in the same file.

So this, in a file that also declares server functions:

```ts
export { MIN_PASSWORD } from "./service"
```

survives verbatim into the browser, making `./service` a real client module —
along with everything it imports. `./service` imported `@/lib/auth` and
`@/db/repositories/accounts`, which put better-auth's server half and
`drizzle` + `pg` in the browser. The symptom is not a build error:

```
PAGEERROR Buffer is not defined
```

and a page that renders (SSR is fine) but never hydrates, so every form falls
back to native submission.

Verified by reading what vite serves for the module — `curl
localhost:PORT/src/lib/accounts/index.ts` shows exactly which imports the
plugin kept.

**Rule:** anything a server-fn module re-exports must come from a module with
no server imports. `src/lib/accounts/rules.ts` exists for that and nothing
else.

## A form that is not hydrated yet submits natively

The sign-in form's `onSubmit` calls `preventDefault`, which does nothing before
React attaches. In dev the server renders the form seconds before the client
bundle finishes compiling, and a click in that window performs a **native GET
submit** — putting the password in the query string, where it reaches browser
history and every access log in between.

```
/sign-in?email=coach%40e2e.test&password=e2e-password
```

Two consequences, both now in the code:

- The form carries `method="post"`, so an un-hydrated submit cannot leak
  credentials into a URL. There is no POST handler for the route, so it fails
  instead — which is the point.
- Playwright's actionability checks (visible, enabled, stable) do **not** imply
  hydrated, so e2e tests wait for it explicitly (`tests/e2e/hydrated.ts`).
  `window.__TSR_ROUTER__` is set before render completes and is not a usable
  signal; React's own `__reactProps$…` key on the element is.

## postgres 18 moved PGDATA

`postgres:18-alpine` refuses to start on a volume mounted at
`/var/lib/postgresql/data` — 18 puts the cluster in a version subdirectory so
`pg_upgrade --link` can work across a single mount. Mount
`/var/lib/postgresql` instead. The container reports `unhealthy` with an
otherwise clean log except for a note about "PostgreSQL data in
/var/lib/postgresql/data (unused mount/volume)".
