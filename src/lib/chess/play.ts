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
 * `refusal` is the last illegal attempt's reason — feedback, not history, so
 * it never joins `moves` and never outlives the next thing that happens.
 */
export type PlayState = {
  start: string
  fen: string
  moves: Array<Ply>
  goal: Goal
  status: GoalOutcome
  refusal: string | null
}

export type PlayAction =
  | { type: "move"; from: Square; to: Square; promotion?: PromotionPiece }
  | { type: "rewind" }
  | { type: "reset" }

/** A Puzzle as it stands before anyone has touched it. */
export function startPlay(puzzle: { fen: string; goal: Goal }): PlayState {
  return {
    start: puzzle.fen,
    fen: puzzle.fen,
    moves: [],
    goal: puzzle.goal,
    status: evaluateGoal(puzzle.goal, []),
    refusal: null,
  }
}

/**
 * The game loop: a Position, the moves played from it, and what the Goal makes
 * of them. Both sides are moved by the person at the board, so every ply here
 * is theirs — which is why Rewind takes back one.
 *
 * A legal but losing move is played like any other. Nothing interrupts it:
 * saying it was wrong needs an analysis engine, and it robs the Student of
 * finding out why it failed (docs/PLAN.md).
 */
export function playReducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case "move": {
      const played = applyMove(
        state.fen,
        action.from,
        action.to,
        action.promotion
      )
      if (!played.ok) {
        // `applyMove`'s own reason is coordinates; a Student gets the sentence.
        return {
          ...state,
          refusal: explainIllegal(state.fen, action.from, action.to),
        }
      }
      return atMoves(state, [
        ...state.moves,
        { fen: played.fen, san: played.san, from: action.from, to: action.to },
      ])
    }
    case "rewind":
      // `slice` on an empty list is an empty list, so a Puzzle nobody has
      // played rewinds to itself rather than past its own start.
      return atMoves(state, state.moves.slice(0, -1))
    case "reset":
      return atMoves(state, [])
  }
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
    status: evaluateGoal(state.goal, moves),
    refusal: null,
  }
}
