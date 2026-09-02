import { createFileRoute } from "@tanstack/react-router"

import { getAuth } from "@/lib/auth"

/** BetterAuth's own endpoints, mounted where its client expects them. */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      ANY: ({ request }) => getAuth().handler(request),
    },
  },
})
