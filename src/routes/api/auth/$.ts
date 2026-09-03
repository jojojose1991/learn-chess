import { createFileRoute } from "@tanstack/react-router"

import { getAuth } from "@/lib/auth"

/**
 * Endpoints the admin plugin mounts that this product has no use for.
 *
 * Nothing is ever removed — `puzzle.coach_id` cascades, so one delete would
 * take a Coach's whole Library and every Puzzle Link a Student is holding —
 * and impersonating a Coach has no business here at all.
 *
 * `set-role` is closed because the plugin's own permission check reads
 * `user.role`: a Coach whose role said "admin" would hold every admin
 * endpoint while `/admin` still answered them 404. The admin is whoever
 * `SEED_ADMIN_USER` names, and closing this leaves no HTTP path that writes
 * the column — so the two cannot disagree.
 */
const closed = new Set([
  "/api/auth/admin/remove-user",
  "/api/auth/admin/impersonate-user",
  "/api/auth/admin/set-role",
])

/** BetterAuth's own endpoints, mounted where its client expects them. */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        if (closed.has(new URL(request.url).pathname))
          return new Response(null, { status: 404 })
        return (await getAuth()).handler(request)
      },
    },
  },
})
