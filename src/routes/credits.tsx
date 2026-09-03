import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/credits")({
  head: () => ({ meta: [{ title: "Credits — Learn Chess" }] }),
  component: Credits,
})

/**
 * The attribution the piece artwork's licence obliges (ADR-0004). Public,
 * because a Student on a Puzzle Link never signs in and still sees the art.
 * Naming which of the four offered licences was elected is the whole point;
 * BSD §3 is why the credit lives here and not on the landing page.
 */
function Credits() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="font-heading text-2xl font-medium">Credits</h1>

      <section className="flex flex-col gap-3 text-sm">
        <h2 className="font-heading text-lg font-medium">
          Chess piece graphics
        </h2>
        <p>
          Copyright &copy; Colin M.L. Burnett (Wikimedia Commons user{" "}
          <a
            className="underline"
            href="https://en.wikipedia.org/wiki/User:Cburnett"
          >
            Cburnett
          </a>
          ), from{" "}
          <a
            className="underline"
            href="https://commons.wikimedia.org/wiki/Template:SVG_chess_pieces"
          >
            Template:SVG chess pieces
          </a>
          .
        </p>
        <p>
          The graphics are multi-licensed by the author under GFDL 1.2+, CC
          BY-SA 3.0, BSD 3-clause and GPLv2+; they are used here under the BSD
          3-clause license.
        </p>
        <p>
          {/* Not a router `Link`: the licence is a served file, not a route. */}
          <a className="underline" href="/pieces/LICENSE">
            BSD 3-clause licence text
          </a>
        </p>
      </section>
    </main>
  )
}
