import { useEffect, useReducer, useState } from "react"

import { MoveBoard } from "@/components/move-board"
import { Button } from "@/components/ui/button"
import { describeGoal } from "@/lib/chess/goals"
import { engineThinking, playReducer, startPlay } from "@/lib/chess/play"
import { cn } from "@/lib/utils"

import type { Square } from "chess.js"
import type { BoardTheme } from "@/db/schema"
import type { PromotionPiece } from "@/lib/chess/rules"
import type { PuzzleDraft } from "@/lib/puzzles/rules"

/** What the engine would play in a Position, or a rejection saying it would not. */
type AskEngine = (
  fen: string
) => Promise<{ from: Square; to: Square; promotion?: PromotionPiece }>

type PlayPuzzleProps = {
  puzzle: PuzzleDraft
  /** The board this Coach teaches on, straight through to the board. */
  theme?: BoardTheme
  /**
   * How the defender is reached. The default is this app's own engine route;
   * a test hands the screen an answer instead, because what it does with one
   * is its contract and where it came from is not.
   *
   * It has to be stable across renders — an inline lambda re-asks on every
   * render while the engine is thinking, and the route's queue is eight deep.
   */
  askEngine?: AskEngine
}

const whiteToMove = (fen: string) => fen.split(" ")[1] === "w"

/** Said out loud when the engine cannot be reached, and not in the move list. */
const ENGINE_QUIET =
  "The engine is not answering. Play its move yourself, or start again."

/**
 * The engine over HTTP: a Position goes in and a move comes back (ADR-0003).
 * Any answer that is not a move is a rejection, because the screen has one
 * thing to say about all of them and the status has no second reader.
 */
const overTheEngineRoute: AskEngine = async (fen) => {
  const answer = await fetch("/api/engine/move", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fen }),
  })
  if (!answer.ok) throw new Error(`the engine route answered ${answer.status}`)
  return answer.json() as ReturnType<AskEngine>
}

/**
 * Play: the Student moves and the engine defends. The loop is `playReducer`
 * and lives nowhere else here — this screen dispatches taps into it, asks the
 * engine when the loop says it is waiting on one, and draws what comes back.
 *
 * Guidance is the one thing it holds itself. It changes no rule, no history and
 * no Goal, so it is a view preference rather than part of the game's state.
 */
export function PlayPuzzle({
  puzzle,
  theme,
  askEngine = overTheEngineRoute,
}: PlayPuzzleProps) {
  const [game, dispatch] = useReducer(playReducer, puzzle, startPlay)
  const [guidance, setGuidance] = useState(true)
  const outcome = game.status
  const thinking = engineThinking(game)
  const { fen } = game

  useEffect(() => {
    if (!thinking) return
    // The Position each action names is not enough on its own: a Rewind and a
    // replay of the same move ask twice about the *same* Position, and the
    // abandoned request's answer would be indistinguishable from the live
    // one's — a stale timeout claiming the engine is silent while it is not.
    let live = true
    askEngine(fen).then(
      ({ from, to, promotion }) => {
        // Field by field, because the body is a cast over the wire: a `type`
        // or a `fen` in it would otherwise rewrite the action it is part of.
        if (live) dispatch({ type: "engine_move", fen, from, to, promotion })
      },
      () => {
        if (live) dispatch({ type: "engine_failed", fen, reason: ENGINE_QUIET })
      }
    )
    return () => {
      live = false
    }
  }, [thinking, fen, askEngine])

  return (
    // 900px is `docs/PLAN.md`'s own number for where the list moves beside the
    // board; below it the list is a strip underneath.
    <div className="flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-start">
      <div className="flex w-full max-w-[80vh] flex-col gap-3 min-[900px]:max-w-[min(80vh,32rem)] min-[900px]:shrink-0">
        <p className="text-sm text-muted-foreground">
          {describeGoal(game.goal)}
        </p>

        <MoveBoard
          fen={game.fen}
          guidance={guidance}
          // A board nobody may move on takes no taps: the engine's turn, or an
          // attempt that has ended and is waiting to be tried again.
          locked={thinking || outcome.status !== "open"}
          // Whose Puzzle it is to solve, decided once by the Position it was
          // stored with. A board that turned round every ply is unusable.
          orientation={whiteToMove(game.start) ? "white" : "black"}
          theme={theme}
          lastMove={game.moves.at(-1)}
          onMove={(from, to, promotion) =>
            dispatch({ type: "move", from, to, promotion })
          }
        />

        {/* The end of an attempt takes the turn line's place: a board nobody
            may move on has no side to move. */}
        <div
          className={cn(
            "flex flex-col items-start gap-3",
            outcome.status !== "open" && "rounded-lg border p-4"
          )}
        >
          {/* One region, mounted from the first render: a live region that
              appears with its text already in it is not reliably announced,
              so the element stays and its contents change. The button is a
              sibling, so a turn change never reads it out. */}
          <div role="status" className="flex flex-col gap-1">
            {outcome.status === "open" ? (
              <p>
                {thinking
                  ? "The engine is thinking…"
                  : `${whiteToMove(game.fen) ? "White" : "Black"} to move`}
              </p>
            ) : (
              <>
                <p className="text-lg font-medium">
                  {outcome.status === "solved" ? "Solved!" : "Not this time"}
                </p>
                {outcome.status === "failed" ? (
                  <p className="text-sm text-muted-foreground">
                    {outcome.reason}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {outcome.status === "failed" ? (
            <Button
              type="button"
              className="min-h-11"
              onClick={() => dispatch({ type: "reset" })}
            >
              Try again
            </Button>
          ) : null}
        </div>

        {game.refusal ? (
          <p role="alert" className="text-sm text-destructive">
            {game.refusal}
          </p>
        ) : null}

        {/* Not destructive, and not a refusal: the Student did nothing wrong
            and nothing they can do is being refused. Announced all the same,
            because the board has just gone back to being theirs. */}
        {game.engineFailure ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {game.engineFailure}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => dispatch({ type: "rewind" })}
          >
            Rewind
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => dispatch({ type: "reset" })}
          >
            Reset
          </Button>
          {/* The whole label is the target, so a five-year-old's finger has
              the 44px it needs rather than whatever a checkbox happens to be. */}
          <label className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring">
            <input
              type="checkbox"
              className="size-4 accent-brand-ink"
              checked={guidance}
              onChange={(event) => setGuidance(event.target.checked)}
            />
            Guidance
          </label>
        </div>
      </div>

      {/* `role` explicitly: Tailwind's preflight sets `list-style: none`, and
          WebKit drops the implicit list role from a list styled that way. */}
      <ol
        role="list"
        aria-label="Moves"
        className="flex min-w-0 flex-1 gap-x-4 gap-y-1 overflow-x-auto rounded-lg border p-3 text-sm min-[900px]:flex-col"
      >
        {game.moves.map((move, ply) => (
          <li key={ply} className="whitespace-nowrap">
            {move.san}
          </li>
        ))}
      </ol>
    </div>
  )
}
