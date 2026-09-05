import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { log } from "@/lib/log"

type PuzzleShareProps = {
  /** The open link this Puzzle has, while it has one. */
  url?: string
  /** Mints one. The screen re-reads the link rather than being told it. */
  onMint: () => Promise<void>
  /** Ends the sharing, so the URL a Student holds stops opening anything. */
  onRevoke: () => Promise<void>
}

/**
 * How a Coach gets a Puzzle to a Student: one unlisted URL, minted when they
 * ask for it and dead when they revoke it.
 *
 * It holds no link of its own — `url` is what the server last said, so a mint
 * and a revoke show only once they have actually happened rather than the
 * moment they were asked for.
 */
export function PuzzleShare({ url, onMint, onRevoke }: PuzzleShareProps) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string>()
  const [error, setError] = useState<string>()

  /**
   * Runs one change and says what happened. Said rather than shown, because
   * the button that was pressed unmounts when it lands — a Coach who is not
   * watching the block has nothing else to tell them it worked.
   */
  async function ask(change: () => Promise<void>, done: string) {
    setBusy(true)
    setNote(undefined)
    setError(undefined)
    try {
      await change()
      setNote(done)
    } catch (failure) {
      // A write that never got an answer at all. Without this the Coach is
      // left with a button that stayed disabled and no link either way.
      log.error(() => `a Puzzle Link change failed: ${String(failure)}`)
      setError("That did not work. Try again.")
    } finally {
      setBusy(false)
    }
  }

  async function copy(link: string) {
    setError(undefined)
    try {
      await navigator.clipboard.writeText(link)
      setNote("Link copied")
    } catch (failure) {
      // Blocked by permission, or by a page that is not on a secure origin.
      log.error(() => `copying a Puzzle Link failed: ${String(failure)}`)
      setError("Copying is blocked here. Select the link and copy it yourself.")
    }
  }

  return (
    <section
      aria-labelledby="share-heading"
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <h2 id="share-heading" className="text-lg">
        Share with a Student
      </h2>

      {url ? (
        <>
          <p className="text-sm text-muted-foreground">
            Anyone with this link can play this Puzzle. There is no sign-in and
            nothing to edit, and it is on the board you teach on today.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-40 flex-1 flex-col gap-2">
              <Label htmlFor="puzzle-link">Puzzle Link</Label>
              <Input
                id="puzzle-link"
                readOnly
                value={url}
                // Selected on focus, so the way out of a blocked clipboard is
                // one tap rather than a drag across a long URL.
                onFocus={(event) => event.currentTarget.select()}
                className="min-h-11"
              />
            </div>
            <Button
              type="button"
              className="min-h-11"
              // Refused while a revoke is in flight, or a Coach copies a URL
              // that is dead by the time they have pasted it.
              disabled={busy}
              onClick={() => void copy(url)}
            >
              Copy link
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => void ask(onRevoke, "Link revoked")}
            >
              Revoke link
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Nobody can open this Puzzle yet.
          </p>
          <Button
            type="button"
            className="min-h-11 self-start"
            disabled={busy}
            onClick={() => void ask(onMint, "Link created")}
          >
            Create link
          </Button>
        </>
      )}

      {/* Mounted from the first render: a live region that appears with its
          text already in it is not reliably announced. */}
      <p role="status" className="text-sm text-muted-foreground">
        {note}
      </p>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  )
}
