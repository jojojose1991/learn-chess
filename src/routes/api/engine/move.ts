import { createFileRoute } from "@tanstack/react-router"

import { bestMove } from "@/lib/engine/service"

/**
 * The move the engine would play in a Position — an action, not a resource:
 * POST, one job, and nothing about the game it belongs to. State lives in the
 * client (ADR-0003), so two identical requests are two identical searches.
 */
export const Route = createFileRoute("/api/engine/move")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const fen = await readFen(request)
        if (fen === null) {
          return fail(400, 'The body must be JSON, as { "fen": "…" }.')
        }

        try {
          // No think time from the body: the route is unauthenticated, so a
          // budget from outside is CPU anyone with a Puzzle Link could buy.
          const outcome = await bestMove(fen)
          if (outcome.ok) {
            const { ok, ...move } = outcome
            return Response.json(move)
          }

          switch (outcome.failure) {
            // The Position could not be played by anyone, which is the
            // caller's mistake and not a broken engine.
            case "illegal_position":
              return fail(422, outcome.reasons.join(" "))
            // A legal Position, already over: there is no move to ask for.
            case "no_move":
              return fail(409, "There is no move to play in this Position.")
            case "timeout":
              return fail(504, "The engine took too long to answer.")
            case "busy":
              return fail(503, "The engine is busy. Try again.")
            case "unavailable":
              return fail(503, "The engine is not answering.")
            // Ours, not the caller's, and not something a retry mends.
            case "misconfigured":
              return fail(500, "The engine's think time is not configured.")
          }
        } catch {
          // Every way the engine can fail is an outcome above, so anything
          // thrown is a bug in here — which still owes the caller the one
          // error shape, and no claim about a cause nobody has established.
          return fail(500, "The engine could not answer.")
        }
      },
    },
  },
})

/** The one field this route reads, or `null` if the body has not got it. */
async function readFen(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.json()
    const fen = (body as { fen?: unknown } | null)?.fen
    return typeof fen === "string" ? fen : null
  } catch {
    return null
  }
}

/** One error envelope, and a status that says which kind of wrong it was. */
const fail = (status: number, error: string) =>
  Response.json({ error }, { status })
