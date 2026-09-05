import { createFileRoute, notFound } from "@tanstack/react-router"

import { PlayPuzzle } from "@/components/play-puzzle"
import { openPuzzleLink } from "@/lib/puzzle-links"

/**
 * A Puzzle Link, and the only screen in the product outside `_coach` that
 * shows a Puzzle. Outside it deliberately: that layout's `beforeLoad` is the
 * auth guard, so living here is what makes a Student's arrival sessionless —
 * and it is the sidebar's layout too, so there is no navigation to leave by.
 *
 * `/p/` and not `/play/`: this URL is typed off a phone screen or tapped in a
 * chat app, and every character is one more to get wrong.
 */
export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const link = await openPuzzleLink({ data: params.slug })
    // A slug that was revoked and one that never existed take this same path,
    // so neither answer tells a stranger which Puzzles are real.
    if (!link) throw notFound()
    return link
  },
  notFoundComponent: Closed,
  component: Play,
})

/** Screen 5, and nothing else: no sign-in, no Library, no way to edit. */
function Play() {
  const link = Route.useLoaderData()

  return (
    // The chrome `_coach.tsx` would otherwise have given it. `p-4` before
    // `sm`: at 390px, `p-6` leaves each square 42.75px, under the 44px a
    // five-year-old's finger needs (docs/PLAN.md) — and a phone is exactly
    // where a Student meets this.
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl break-words">{link.puzzle.name}</h1>

      {/* No `key`: nothing links from one Puzzle Link to another, so a
          second slug arrives as a fresh document and remounts anyway. */}
      <PlayPuzzle puzzle={link.puzzle} theme={link.boardTheme} />
    </main>
  )
}

/**
 * Revoked, or never minted. One answer for both, and a dead end: there is
 * nowhere for a Student to be sent on to, and nothing they could sign in to.
 */
function Closed() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 p-6 pt-16">
      <h1 className="text-2xl">This link is closed</h1>
      <p className="text-muted-foreground">Ask your coach for a new one.</p>
    </main>
  )
}
