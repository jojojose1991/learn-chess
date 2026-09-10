/**
 * The little a route needs from a `Request` that the platform will not do.
 */

/**
 * The body as bytes, or `"too_large"` past `maxBytes`.
 *
 * Counted as it arrives rather than buffered and measured: `arrayBuffer()`
 * and `json()` read everything before anyone can object, and `content-length`
 * is the caller's own claim — a caller who means harm omits it and a chunked
 * body has not got one at all, which is why ticket 12's review declined the
 * header on its own. Leaving the loop early releases the stream, so the bytes
 * past the cap are never read either.
 *
 * A request with no body reads as no bytes, so a caller who sent nothing is
 * answered by whatever parses it and not told their nothing was too big.
 */
export async function readBounded(
  request: Request,
  maxBytes: number
): Promise<Uint8Array | "too_large"> {
  if (!request.body) return new Uint8Array()

  const chunks: Array<Uint8Array> = []
  let size = 0
  for await (const chunk of request.body) {
    size += chunk.byteLength
    if (size > maxBytes) return "too_large"
    chunks.push(chunk)
  }

  // Joined by hand rather than with `Buffer.concat`, which answers a `Buffer`
  // where this promises a `Uint8Array` — the same bytes, and a different
  // constructor for every caller that compares one.
  const body = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    body.set(chunk, at)
    at += chunk.byteLength
  }
  return body
}
