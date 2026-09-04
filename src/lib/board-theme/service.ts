import { updateBoardTheme } from "@/db/repositories/accounts"
import { getCoach, isBoardTheme } from "@/lib/auth"

import type { BoardTheme } from "@/db/schema"

/**
 * The board this Coach teaches on from now on. The Coach comes from the
 * session, so a request can only ever repaint its own board, and the theme is
 * checked here because a server function's validator is a type annotation that
 * strips nothing at runtime.
 *
 * Nothing to answer with: a Coach reads no message from either refusal, and
 * the caller re-reads the session afterwards — which sends a Coach whose
 * session went to sign-in, and leaves a rejected theme visibly unchanged.
 */
export async function chooseBoardTheme(theme: BoardTheme, headers: Headers) {
  const coach = await getCoach(headers)
  if (!coach || !isBoardTheme(theme)) return

  await updateBoardTheme(coach.id, theme)
}
