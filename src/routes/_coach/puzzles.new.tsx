import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { CornerPicker } from "@/components/corner-picker"
import { PuzzleEditor } from "@/components/puzzle-editor"
import { Label } from "@/components/ui/label"
import { completeFen, withPlacementRotated } from "@/lib/chess/rules"
import { log } from "@/lib/log"
import { savePuzzle } from "@/lib/puzzles"
import { GOAL_N_MIN } from "@/lib/puzzles/rules"

import type { Quad, ScanRead, SeenFrom } from "@/lib/scan/rules"

export const Route = createFileRoute("/_coach/puzzles/new")({
  component: NewPuzzle,
})

/** What a Scan that read nothing usable says, in place of a draft. */
const UNREADABLE =
  "That image did not read cleanly, so there is no draft worth checking. Use the handles below, or place the pieces by hand."

/** A file that decoded nowhere, so there is nothing to put handles on. */
const NOT_SHOWABLE =
  "That file could not be opened as a picture, so there are no corners to place. Try a PNG or a JPEG."

/**
 * What a Scan says about corners it read but is not sure of. A draft either
 * way, because minimum confidence collapses at about a seventh of a tile,
 * where the read is still perfect — so refusing this would throw away correct
 * Positions (docs/learnings/board-recognition.md).
 */
const CORNERS_OFF =
  "Those corners may be off. There is a draft below either way — check every square, or move a handle and read it again."

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

  const [image, setImage] = useState<File | null>(null)
  const [picture, setPicture] = useState<Picture | null>(null)
  const [picking, setPicking] = useState(false)
  const [showable, setShowable] = useState(true)
  const [placement, setPlacement] = useState<string | null>(null)
  const [seenFrom, setSeenFrom] = useState<SeenFrom>("white")
  const [refusal, setRefusal] = useState<string>()
  const [warning, setWarning] = useState<string>()
  const [scanning, setScanning] = useState(false)

  // The chosen file as something the corner handles can sit on, and its own
  // size, which is what a corner is measured in. Held only as long as the
  // file is: the browser keeps an object URL alive until it is told not to.
  useEffect(() => {
    if (!image) return
    const url = URL.createObjectURL(image)
    const shown = new Image()
    let live = true
    shown.onload = () => {
      // A load that lands after the Coach has chosen something else would
      // otherwise put a revoked URL into state.
      if (live) {
        // The browser has already turned the picture the way the photograph
        // says it was taken, so these are the corners' own units — and the
        // server stands its own copy up to match (src/lib/scan/orientation.ts).
        setPicture({
          url,
          width: shown.naturalWidth,
          height: shown.naturalHeight,
        })
      }
    }
    // Its own state and not `refusal`: the server has one of those, the two
    // land in either order, and "use the handles below" over no handles at
    // all is the one sentence here that could be a lie.
    shown.onerror = () => {
      if (live) setShowable(false)
    }
    shown.src = url
    return () => {
      live = false
      setPicture(null)
      URL.revokeObjectURL(url)
    }
  }, [image])

  /**
   * One read of one image, with the corners a Coach placed or without them.
   * Without, the detector finds the board; with, our own warp squares it up
   * first — the same route, the same classifier, the same answer.
   */
  async function scanImage(file: File, corners?: Quad) {
    setScanning(true)
    setRefusal(undefined)
    setWarning(undefined)
    try {
      // The file itself is the body: one image, one job, and neither end
      // keeps it afterwards. The corners, where there are any, ride the URL.
      const query = corners
        ? `?corners=${corners.flatMap(({ x, y }) => [x, y]).join(",")}`
        : ""
      const response = await fetch(`/api/scan${query}`, {
        method: "POST",
        body: file,
      })
      const answer = (await response.json()) as ScanRead & { error?: string }

      // An automatic read nobody can trust is said plainly rather than opened
      // as a draft, because a bad Position that looks confirmed is worse than
      // no Scan at all — and the handles are the way out of it rather than a
      // dead end. A *corner* read is the other way round: its confidence
      // collapses while the read is still perfect, so it opens with a warning.
      if (!response.ok || (!answer.reliable && !corners)) {
        // A refused *corner* read keeps whatever draft the last good one
        // left: the Coach was refining a Position, and losing it to one
        // crossed-over handle would be a punishment for adjusting.
        if (!corners) setPlacement(null)
        // Only where corners are an answer. A file that is too large or is
        // not an image at all comes back the same size however it is warped,
        // and handles under it would be an invitation to a second 413.
        const offering = response.ok || response.status === 422
        setPicking(offering)
        // The screen's own sentence wherever the handles are the answer,
        // because the server's says what was wrong and not what to try:
        // `no_board` is what the detector answers about a *photograph*, which
        // is the case the handles exist for, and "no board was found" leaves
        // a Coach staring at four of them. The two the server distinguishes
        // there — nothing found, and found but not trusted — ask for the same
        // thing, so they say the same thing. Elsewhere it is the server's:
        // too large or not a picture is worth naming, and offers no handles.
        setRefusal(
          offering && !corners ? UNREADABLE : (answer.error ?? UNREADABLE)
        )
      } else {
        setPlacement(answer.placement)
        // The suggestion, and no further than this control: the placement is
        // what the classifier saw, never what the heuristic made of it.
        setSeenFrom(answer.seenFrom ?? "white")
        if (!answer.reliable) setWarning(CORNERS_OFF)
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
            const chosen = event.target.files?.[0]
            if (!chosen) return
            // Cleared, or picking the same file after a failure fires no
            // change event at all and the Coach cannot try it again.
            event.target.value = ""
            setImage(chosen)
            setPicking(false)
            setPlacement(null)
            void scanImage(chosen)
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

      {picking && !showable ? (
        <p role="alert" className="text-sm text-destructive">
          {NOT_SHOWABLE}
        </p>
      ) : null}

      {/* Always rendered, unlike the alerts above it: a polite live region
          inserted along with its text is announced by roughly nobody, and
          this is the sentence that says the corners need moving. Empty, it is
          taken out of the layout by being taken out of flow — `hidden` would
          take it out of the accessibility tree too, which is the thing being
          avoided. */}
      <p
        role="status"
        className="text-sm text-destructive empty:absolute empty:size-0 empty:overflow-hidden"
      >
        {warning}
      </p>

      {picking && picture ? (
        <CornerPicker
          src={picture.url}
          width={picture.width}
          height={picture.height}
          reading={scanning}
          onCorners={(corners) => {
            if (image) void scanImage(image, corners)
          }}
        />
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

/** The chosen file as the corner handles see it. */
type Picture = { url: string; width: number; height: number }
