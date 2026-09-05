import { evaluateGoal } from "./goals"
import { applyMove, explainIllegal } from "./rules"

import type { Square } from "chess.js"
import type { Goal, GoalOutcome } from "./goals"
import type { PlayedMove, PromotionPiece } from "./rules"

/** A move that was played, and the two squares it was played between. */
export type Ply = PlayedMove & { from: Square; to: Square }

/**
 * A Puzzle being played. `start` is the Puzzle's own Position, which is what
 * makes Reset a move of the game rather than something the screen re-derives.
 * `refusal` is the last illegal attempt's reason and `engineFailure` the last
 * thing the engine could not do — both feedback, not history, so neither joins
 * `moves` and neither outlives the next thing that happens.
 */
export type PlayState = {
  start: string
  fen: string
  moves: Array<Ply>
  goal: Goal
  status: GoalOutcome
  refusal: string | null
  engineFailure: string | null
}

export type PlayAction =
  | { type: "move"; from: Square; to: Square; promotion?: PromotionPiece }
  /**
   * The defender's answer, and the Position it was asked about — which is what
   * lets a reply to a Position the Student has since left be dropped rather
   * than played somewhere it was never meant for.
   */
  | {
      type: "engine_move"
      fen: string
      from: Square
      to: Square
      promotion?: PromotionPiece
    }
  /**
   * The engine did not answer about that Position — which the Position is
   * part of for the same reason a reply carries one: a timeout for a
   * Position the game has left would unlock the board mid-think and blame a
   * request that is still running.
   */
  | { type: "engine_failed"; fen: string; reason: string }
  | { type: "rewind" }
  | { type: "reset" }

/** A Puzzle as it stands before anyone has touched it. */
export function startPlay(puzzle: { fen: string; goal: Goal }): PlayState {
  return {
    start: puzzle.fen,
    fen: puzzle.fen,
    moves: [],
    goal: puzzle.goal,
    status: evaluateGoal(puzzle.goal, puzzle.fen, []),
    refusal: null,
    engineFailure: null,
  }
}

/**
 * Whether the loop is waiting on the defending engine, which is what stops the
 * board taking taps meant for a side that is not the Student's.
 *
 * The Student moves first, so the odd-numbered plies are the engine's — the
 * same parity `evaluateGoal` counts the budget by, and the reason a reply is
 * free. An engine that has already failed is not thought about any longer: the
 * board goes back to the person at it, who can play the reply themselves.
 */
export const engineThinking = (state: PlayState) =>
  state.status.status === "open" &&
  state.moves.length % 2 === 1 &&
  state.engineFailure === null

/**
 * The game loop: a Position, the moves played from it, and what the Goal makes
 * of them. The Student moves and the engine answers, so Rewind takes back the
 * pair — landing on a Position the Student is to move in, whether or not the
 * answer arrived.
 *
 * A legal but losing move is played like any other. Nothing interrupts it:
 * saying it was wrong needs an analysis engine, and it robs the Student of
 * finding out why it failed (docs/PLAN.md) — until the Goal closes, after
 * which the loop takes no more moves and Rewind or Reset is the way on.
 */
export function playReducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case "move": {
      // An attempt that has ended takes no more moves. Without this a Position
      // stored in checkmate answers every tap with "That would leave your king
      // in danger", which is a reason for a move nobody is still allowed.
      if (state.status.status !== "open") return state
      // The engine's turn is not the Student's to take, and the board is
      // locked while it thinks — this is the same rule where the loop keeps it.
      if (engineThinking(state)) return state

      return (
        advanced(state, action) ?? {
          // `applyMove`'s own reason is coordinates; a Student gets a sentence.
          ...state,
          refusal: explainIllegal(state.fen, action.from, action.to),
        }
      )
    }
    case "engine_move": {
      // Not waiting for one, or waiting for one about a Position that has
      // since been rewound or reset: a late reply belongs to a game that has
      // moved on, and playing it here would answer the wrong board.
      if (!engineThinking(state) || state.fen !== action.fen) return state

      // Legality is the client's to say (ADR-0003), so this is where a corrupt
      // reply stops — and it stops as the engine failing, which hands the
      // board back rather than leaving it waiting on a move that never comes.
      return (
        advanced(state, action) ?? {
          ...state,
          engineFailure: "The engine sent a move that cannot be played.",
        }
      )
    }
    case "engine_failed":
      if (state.fen !== action.fen) return state
      return { ...state, engineFailure: action.reason }
    case "rewind":
      // Back to the Student's own last turn: their move and the engine's
      // answer to it go together, because taking back one would hand them a
      // Position that is the engine's to move. An unanswered move is one ply,
      // an answered one is two — and `slice` past the front of a short list is
      // an empty list, so a Puzzle nobody has played rewinds to itself.
      return atMoves(
        state,
        state.moves.slice(0, state.moves.length % 2 ? -1 : -2)
      )
    case "reset":
      return atMoves(state, [])
  }
}

/**
 * The Puzzle with that move played onto the line, or `null` if it cannot be
 * played at all. Whose move it was is the caller's to say, and so is what a
 * refusal means — that is the only difference between the two that call this.
 */
function advanced(
  state: PlayState,
  move: { from: Square; to: Square; promotion?: PromotionPiece }
): PlayState | null {
  const played = applyMove(state.fen, move.from, move.to, move.promotion)
  if (!played.ok) return null
  return atMoves(state, [
    ...state.moves,
    { fen: played.fen, san: played.san, from: move.from, to: move.to },
  ])
}

/**
 * The Puzzle with exactly those moves played. One place asks the Goal what it
 * makes of them, so a rewound move reopens a Goal it had closed.
 */
function atMoves(state: PlayState, moves: Array<Ply>): PlayState {
  return {
    ...state,
    fen: moves.at(-1)?.fen ?? state.start,
    moves,
    status: evaluateGoal(state.goal, state.start, moves),
    refusal: null,
    engineFailure: null,
  }
}
