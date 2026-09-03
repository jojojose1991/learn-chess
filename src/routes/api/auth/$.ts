import { createFileRoute } from "@tanstack/react-router"

import { getAuth } from "@/lib/auth"

/**
 * Endpoints the admin plugin mounts that this product has no use for.
 *
 * Nothing is ever removed — `puzzle.coach_id` cascades, so one delete would
 * take a Coach's whole Library and every Puzzle Link a Student is holding —
 * and impersonating a Coach has no business here at all.
 *
 * `set-role`, `update-user` and `create-user` all write `user.role`, which is
 * what makes a Coach an admin. None has a screen, so leaving them open would
 * mean the only way to promote anyone was a request nothing in the product
 * sends. `update-user` rewrites `email` too, so it is also how an admin could
 * lock themselves out. They open again when promote and demote get a screen.
 *
 * Closing `create-user` does not touch `addCoach`: that calls
 * `auth.api.createUser` in process, never over HTTP.
 */
const closed = new Set([
  "/api/auth/admin/remove-user",
  "/api/auth/admin/impersonate-user",
  "/api/auth/admin/set-role",
  "/api/auth/admin/update-user",
  "/api/auth/admin/create-user",
])

/** BetterAuth's own endpoints, mounted where its client expects them. */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      ANY: ({ request }) => {
        if (closed.has(new URL(request.url).pathname))
          return new Response(null, { status: 404 })
        return getAuth().handler(request)
      },
    },
  },
})
