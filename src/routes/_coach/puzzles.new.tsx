import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_coach/puzzles/new")({
  component: NewPuzzle,
})

function NewPuzzle() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="font-heading text-2xl font-medium">New Puzzle</h1>
    </main>
  )
}
