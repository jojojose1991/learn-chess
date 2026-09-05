import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"

import { PuzzleEditor } from "@/components/puzzle-editor"
import { Label } from "@/components/ui/label"
import { completeFen, withPlacementRotated } from "@/lib/chess/rules"
import { log } from "@/lib/log"
import { savePuzzle } from "@/lib/puzzles"
import { GOAL_N_MIN } from "@/lib/puzzles/rules"

import type { ScanRead, SeenFrom } from "@/lib/scan/rules"

export const Route = createFileRoute("/_coach/puzzles/new")({
  component: NewPuzzle,
})

/** What a Scan that read nothing usable says, in place of a draft. */
const UNREADABLE =
  "That image did not read cleanly, so there is no draft worth checking. Try a screenshot with the whole board in it and square-on, or place the pieces by hand."

/**
 * The two ways into a Puzzle: scan an image of a board, or start from an empty
 * one. Either way it is Confirm & Edit that opens, because a Scan always
 * produces a draft for a person to check and never a Position that goes
 * straight into play.
 */
function NewPuzzle() {
  const router = useRouter()
  const navigate = Route.useNavigate()
  // The guard already read the session; the theme rides along with the Coach.
  const { coach } = Route.useRouteContext()

  const [placement, setPlacement] = useState<string | null>(null)
  const [seenFrom, setSeenFrom] = useState<SeenFrom>("white")
  const [refusal, setRefusal] = useState<string>()
  const [scanning, setScanning] = useState(false)

  async function scanImage(image: File) {
    setScanning(true)
    setRefusal(undefined)
    setPlacement(null)
    try {
      // The file itself is the body: one image, one job, and neither end
      // keeps it afterwards.
      const response = await fetch("/api/scan", { method: "POST", body: image })
      const answer = (await response.json()) as ScanRead & { error?: string }

      if (!response.ok) {
        setRefusal(answer.error ?? UNREADABLE)
      } else if (!answer.reliable) {
        // Said plainly rather than opened as a draft: a bad Position that
        // looks confirmed is worse than no Scan at all.
        setRefusal(UNREADABLE)
      } else {
        setPlacement(answer.placement)
        // The suggestion, and no further than this control: the placement is
        // what the classifier saw, never what the heuristic made of it.
        setSeenFrom(answer.seenFrom ?? "white")
      }
    } catch (failure) {
      log.error(() => `scanning an image failed: ${String(failure)}`)
      setRefusal("That did not scan. Try again.")
    } finally {
      setScanning(false)
    }
  }

  // Turning the board round is the one transform a Scan may need, and this
  // control is what makes it: read from Black's side, the placement is
  // mirrored, and a mirrored placement is not a Position anyone can play.
  const scanned =
    placement &&
    (seenFrom === "black"
      ? withPlacementRotated(placement)
      : completeFen(placement))

  return (
    // Padding is `p-4` before `sm`: at 390px, `p-6` leaves each square 42.75px,
    // under the 44px a five-year-old's finger needs (docs/PLAN.md).
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl">New Puzzle</h1>

      <div className="flex flex-col gap-2">
        <Label htmlFor="board-image">Scan an image of a board</Label>
        <input
          id="board-image"
          type="file"
          accept="image/png,image/jpeg"
          disabled={scanning}
          onChange={(event) => {
            const image = event.target.files?.[0]
            if (image) void scanImage(image)
          }}
          className="min-h-11 w-full rounded-lg border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
        />
        <p className="text-sm text-muted-foreground">
          {scanning
            ? "Reading the board…"
            : "A screenshot reads best, and every Scan is a draft to check."}
        </p>
      </div>

      {refusal ? (
        <p role="alert" className="text-sm text-destructive">
          {refusal}
        </p>
      ) : null}

      {scanned ? (
        <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
          <legend className="px-1 text-sm text-muted-foreground">
            Board seen from
          </legend>
          <div className="flex flex-wrap gap-2">
            {(["white", "black"] as const).map((side) => (
              <label
                key={side}
                className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
              >
                <input
                  type="radio"
                  name="seen-from"
                  className="size-4 accent-brand-ink"
                  checked={seenFrom === side}
                  onChange={() => setSeenFrom(side)}
                />
                {side === "white" ? "White's side" : "Black's side"}
              </label>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Check every square before you save. Changing this turns the board
            round and starts the draft again.
          </p>
        </fieldset>
      ) : null}

      <PuzzleEditor
        // A remount, so a Scan opens on what it read rather than on whatever
        // the editor's own state was holding before it.
        key={scanned ?? "by-hand"}
        puzzle={
          scanned
            ? {
                name: "",
                fen: scanned,
                goal: { kind: "mate_in", n: GOAL_N_MIN },
              }
            : undefined
        }
        theme={coach.boardTheme}
        onSave={async (draft, next) => {
          const written = await savePuzzle({ data: draft })
          if ("error" in written) return written
          // The Library is where a saved Puzzle now is, so that is where the
          // Coach goes to see that it arrived — unless they asked to play it.
          await router.invalidate()
          await navigate(
            next === "play"
              ? { to: "/play/$puzzleId", params: { puzzleId: written.id } }
              : { to: "/" }
          )
          return {}
        }}
      />
    </main>
  )
}
