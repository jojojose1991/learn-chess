import { createFileRoute } from "@tanstack/react-router"

import { readBounded } from "@/lib/http"
import { log } from "@/lib/log"
import { scan } from "@/lib/scan/service"

import type { Quad } from "@/lib/scan/rules"

/**
 * The placement read out of an image of a board — an action, not a resource:
 * POST, one job, the image as the body and nothing kept afterwards. A Scan
 * always answers a draft for a Coach to check, so an unreliable read is an
 * answer with `reliable: false` in it and not an error.
 *
 * `?corners=x,y,x,y,x,y,x,y` is the recovery path for a photograph: the four
 * the Coach dragged onto the board, clockwise from its top left. They ride the
 * query string because the body is already the image and no multipart parser
 * is installed for a second field — the same action, told where to look.
 */
export const Route = createFileRoute("/api/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const corners = quadFrom(
            new URL(request.url).searchParams.get("corners")
          )
          if (corners === "malformed") {
            return fail(400, "Those corner positions were not four points.")
          }

          // The body is read by the service, and only once it knows who is
          // asking — a thunk rather than bytes, so an upload from a stranger
          // costs no memory at all.
          const outcome = await scan(
            () => readBounded(request, MAX_UPLOAD_BYTES),
            request.headers,
            corners
          )
          if (outcome.ok) return Response.json(outcome.scan)

          switch (outcome.failure) {
            // Not a 404: this route guards nothing an unlisted URL would give
            // away, and the caller has to be told to sign in again.
            case "unauthenticated":
              return fail(401, "Sign in to scan an image.")
            case "too_large":
              return fail(
                413,
                `That image is too large. ${MAX_MEGABYTES} megabytes is the most.`
              )
            case "not_an_image":
              return fail(415, "That file is not a PNG or a JPEG image.")
            case "too_many_pixels":
              return fail(413, "That image has too many pixels to read.")
            case "unreadable":
              return fail(422, "That image could not be read.")
            case "no_board":
              return fail(422, "No board was found in that image.")
            case "bad_corners":
              return fail(
                422,
                "Those four corners are not the corners of a board. Put one on each, going clockwise from the top left."
              )
          }
        } catch (failure) {
          // Every way a Scan can fail is an outcome above, so anything thrown
          // is a bug in here or a caller who hung up mid-upload. Either still
          // owes the one error shape. The line names no filename and no
          // bytes: an uploaded image is not ours to write down.
          log.error(() => `a Scan failed: ${stack(failure)}`)
          return fail(500, "That image could not be scanned.")
        }
      },
    },
  },
})

/**
 * Eight numbers a Coach's browser sent, as a quad — or `"malformed"`, which is
 * a badly formed request rather than a badly placed corner.
 */
function quadFrom(corners: string | null): Quad | "malformed" | undefined {
  if (corners === null) return undefined

  const numbers = corners.split(",").map(Number)
  if (numbers.length !== 8 || !numbers.every(Number.isFinite)) {
    return "malformed"
  }
  return [0, 2, 4, 6].map((at) => ({
    x: numbers[at],
    y: numbers[at + 1],
  })) as Quad
}

/**
 * The most an upload may weigh. Generous enough for a 5K screenshot and for
 * the phone photo ticket 15 will send down the same route.
 */
const MAX_MEGABYTES = 12
const MAX_UPLOAD_BYTES = MAX_MEGABYTES * 1024 * 1024

/** What a thrown thing has to say, with its frames if it brought any. */
const stack = (failure: unknown) =>
  failure instanceof Error
    ? (failure.stack ?? failure.message)
    : String(failure)

/** One error envelope, and a status that says which kind of wrong it was. */
const fail = (status: number, error: string) =>
  Response.json({ error }, { status })
