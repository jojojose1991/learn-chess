import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { KeyboardEvent, PointerEvent } from "react"
import type { Corner, Quad } from "@/lib/scan/rules"

type CornerPickerProps = {
  /** The picture the Coach chose, as something an `<img>` can show. */
  src: string
  /** Its own pixels, which is what a corner is finally measured in. */
  width: number
  height: number
  /** A read is under way, so a second set of corners is not taken on top. */
  reading: boolean
  /** The four corners in the picture's pixels, clockwise from its top left. */
  onCorners: (quad: Quad) => void
}

/**
 * Where each handle starts and what it is called. Inset from the edge rather
 * than on it, so all four are visible and grabbable before a Coach has touched
 * any of them — and in the clockwise order `Quad` is declared in.
 */
const HANDLES = [
  { name: "Top left", x: 0.1, y: 0.1 },
  { name: "Top right", x: 0.9, y: 0.1 },
  { name: "Bottom right", x: 0.9, y: 0.9 },
  { name: "Bottom left", x: 0.1, y: 0.9 },
] as const

/**
 * How far an arrow key moves a handle, as a fraction of the picture. A tile is
 * an eighth of the board and the read tolerates about a seventh of a tile, so
 * a tenth of a percent is a step well inside the margin, and ten of those with
 * Shift held.
 */
const NUDGE = 0.001

const ARROWS: Record<string, Corner | undefined> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

/** The loupe: how much bigger it draws the picture, and how wide it is. */
const LOUPE_ZOOM = 2
const LOUPE_PX = 112

/**
 * Where to put a picture blown up `LOUPE_ZOOM` times so that the corner under
 * the handle sits in the middle of the loupe. The only part of the loupe that
 * can be silently wrong — everything else about it is a circle with a cross in
 * it, which a person sees or does not.
 */
export function loupeBackground(corner: Corner, width: number, height: number) {
  return {
    backgroundSize: `${width * LOUPE_ZOOM}px ${height * LOUPE_ZOOM}px`,
    backgroundPosition: `${LOUPE_PX / 2 - corner.x * width * LOUPE_ZOOM}px ${
      LOUPE_PX / 2 - corner.y * height * LOUPE_ZOOM
    }px`,
  }
}

/**
 * The recovery path's screen half: a handle on each corner of the board, and a
 * loupe of what is under the one being moved.
 *
 * The loupe is not decoration. A misplaced corner costs the read its
 * confidence at about a seventh of a tile — 11 px on the one keystoned
 * picture measured — and a finger covers rather more than that (ADR-0002).
 *
 * The screen never decides whether four corners are a board; the server does.
 */
export function CornerPicker({
  src,
  width,
  height,
  reading,
  onCorners,
}: CornerPickerProps) {
  const picture = useRef<HTMLDivElement>(null)
  const [quad, setQuad] = useState<Quad>(
    () => HANDLES.map(({ x, y }) => ({ x, y })) as Quad
  )
  const [showing, setShowing] = useState<number | null>(null)

  /** `move` is given the corner as it stands, so two keys in one frame are two moves. */
  const moveTo = (at: number, move: (corner: Corner) => Corner) =>
    setQuad(
      (was) =>
        was.map((corner, index) => {
          if (index !== at) return corner
          const { x, y } = move(corner)
          return { x: within(x), y: within(y) }
        }) as Quad
    )

  function dragged(at: number, event: PointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const box = picture.current?.getBoundingClientRect()
    if (!box?.width || !box.height) return
    moveTo(at, () => ({
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    }))
  }

  function nudged(at: number, event: KeyboardEvent<HTMLButtonElement>) {
    const arrow = ARROWS[event.key]
    if (!arrow) return
    // Or the page scrolls out from under the handle being placed.
    event.preventDefault()
    // Not redundant with `onFocus`: a mouse drag leaves the handle focused
    // with the loupe already put away, and the next arrow key wants it back.
    setShowing(at)
    const by = event.shiftKey ? NUDGE * 10 : NUDGE
    moveTo(at, ({ x, y }) => ({ x: x + arrow.x * by, y: y + arrow.y * by }))
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Put a handle on each corner of the board. The circle shows what is under
        the one you are moving, and the arrow keys move it a hair at a time.
      </p>

      <div ref={picture} className="relative select-none">
        <img
          src={src}
          alt="The picture you chose, with a handle on each corner of the board"
          draggable={false}
          // `ring` rather than `border`: a border is inside the box, so it
          // would inset the picture from the rect every corner is measured
          // against — a whole pixel of the display, which on a phone
          // photograph shown at 358px is 8 image pixels, the entire measured
          // tolerance (docs/learnings/board-recognition.md).
          className="block w-full rounded-lg ring-1 ring-border"
        />

        {showing === null ? null : (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-2 z-10 overflow-hidden rounded-full border-2 border-brand-ink bg-background shadow-lg",
              // Out from under the hand: the loupe sits on the far side of the
              // picture from the corner being moved.
              quad[showing].x < 0.5 ? "right-2" : "left-2"
            )}
            style={{
              width: LOUPE_PX,
              height: LOUPE_PX,
              backgroundImage: `url(${src})`,
              backgroundRepeat: "no-repeat",
              ...loupeBackground(quad[showing], width, height),
            }}
          >
            <span className="absolute inset-x-0 top-1/2 h-px bg-brand-ink" />
            <span className="absolute inset-y-0 left-1/2 w-px bg-brand-ink" />
          </div>
        )}

        {HANDLES.map(({ name }, at) => (
          <button
            key={name}
            type="button"
            // Where it is, said out loud, because a handle nobody can see is
            // a handle nobody can place. A name that changes under an already
            // focused button is not reliably re-announced, so this is what a
            // screen reader has on arrival rather than a running commentary.
            aria-label={`${name} corner, ${percent(quad[at].x)}% across and ${percent(quad[at].y)}% down`}
            style={{
              left: `${quad[at].x * 100}%`,
              top: `${quad[at].y * 100}%`,
            }}
            // 44px of hit area around a 6px mark, and `touch-none` so a drag
            // moves the handle instead of scrolling the page.
            className="absolute size-11 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-brand-ink bg-brand-ink/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              setShowing(at)
            }}
            onPointerMove={(event) => dragged(at, event)}
            onPointerUp={() => setShowing(null)}
            // A second finger, or the OS taking the pointer, ends the drag
            // without a pointerup — and would leave the loupe pinned there.
            onPointerCancel={() => setShowing(null)}
            onKeyDown={(event) => nudged(at, event)}
            onFocus={() => setShowing(at)}
            onBlur={() => setShowing(null)}
          >
            <span
              aria-hidden
              className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-ink"
            />
          </button>
        ))}
      </div>

      <Button
        type="button"
        disabled={reading}
        className="min-h-11 self-start"
        onClick={() =>
          onCorners(
            quad.map(({ x, y }) => ({
              x: rounded(x * width),
              y: rounded(y * height),
            })) as Quad
          )
        }
      >
        Read these corners
      </Button>
    </div>
  )
}

const within = (fraction: number) => Math.min(1, Math.max(0, fraction))

/** A tenth of a percent, which is the step, so every nudge shows in the name. */
const percent = (fraction: number) => (fraction * 100).toFixed(1)

/** A tenth of a pixel is past what any handle can mean; the rest is noise. */
const rounded = (pixels: number) => Math.round(pixels * 10) / 10
