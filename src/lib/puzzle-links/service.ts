import {
  findOpenLinkByPuzzle,
  findOpenLinkBySlug,
  insertPuzzleLink,
  revokeLinksByPuzzle,
} from "@/db/repositories/puzzle-links"
import { findPuzzleByCoach } from "@/db/repositories/puzzles"
import { boardThemeOf, getCoach } from "@/lib/auth"
import { requireEnv } from "@/lib/env"
import { isPuzzleId } from "@/lib/puzzles/rules"

import type { BoardTheme } from "@/db/schema"
import type { Goal } from "@/lib/chess/goals"

/** A live link, as the Coach who minted it reads it: the URL they paste. */
export type MintedLink = { url: string }

/**
 * What a slug opens, and the whole of what crosses to a Student: a Position,
 * a Goal and the board it is played on. No id, no Coach, no name of anything
 * they did not open — a Student is never signed in, so this DTO is the only
 * thing standing between them and the row behind it.
 */
export type OpenedPuzzle = {
  puzzle: { name: string; fen: string; goal: Goal }
  boardTheme: BoardTheme
}

/**
 * The 32 characters a slug is drawn from. No 1, i, l or o: a Coach reads one
 * of these out or types it off a phone screen. 256 is a whole number of 32s,
 * so masking five bits off a random byte is uniform and needs no rejection.
 */
const SLUG_ALPHABET = "023456789abcdefghjkmnpqrstuvwxyz"
const SLUG_LENGTH = 8

/**
 * An unlisted slug: 40 bits, which is what stands between a Puzzle and a
 * stranger guessing at one. Drawn once and inserted, with no re-draw — the
 * primary key refuses a repeat, and the first insert in a million only fails
 * once a million links exist, where pressing the button again is the answer.
 */
function newSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SLUG_LENGTH))
  return Array.from(bytes, (byte) => SLUG_ALPHABET[byte & 31]).join("")
}

/**
 * Where this app is, so what a Coach copies is a whole URL rather than a path
 * they have to graft an origin onto. `BETTER_AUTH_URL` is already the origin
 * the session cookie is set for, so there is no second answer to keep in step.
 */
function linkUrl(slug: string): string {
  return new URL(`/p/${slug}`, requireEnv("BETTER_AUTH_URL")).toString()
}

/**
 * Whether this Puzzle is the Coach's own. Every one of the three below asks
 * this and none of the queries carry a Coach, so a link is only ever minted,
 * read or revoked over a Puzzle the session owns — one rule, in one place,
 * rather than a `where` clause per query that no test below e2e can hold.
 *
 * The id is checked first because postgres raises on a uuid column handed a
 * string that is not one, which would be a 500 where this has to be a refusal.
 */
async function ownsPuzzle(puzzleId: string, coachId: string) {
  if (!isPuzzleId(puzzleId)) return false
  return (await findPuzzleByCoach(puzzleId, coachId)).length > 0
}

/**
 * The URL a Student opens this Puzzle on, minting one if it has none yet.
 *
 * The board is stamped on at minting and never read again, so a Coach who
 * later teaches on the other board does not repaint the link a Student is
 * already holding. Minting twice hands back the link that exists rather than
 * a second one to keep track of — which is also why that stamp is stable.
 */
export async function mintLink(
  puzzleId: string,
  headers: Headers
): Promise<MintedLink | null> {
  const coach = await getCoach(headers)
  if (!coach || !(await ownsPuzzle(puzzleId, coach.id))) return null

  const existing = (await findOpenLinkByPuzzle(puzzleId)).at(0)
  if (existing) return { url: linkUrl(existing.slug) }

  const slug = newSlug()
  await insertPuzzleLink(slug, puzzleId, coach.boardTheme)
  return { url: linkUrl(slug) }
}

/** The live link this Coach's Puzzle already has, or null. Mints nothing. */
export async function readLink(
  puzzleId: string,
  headers: Headers
): Promise<MintedLink | null> {
  const coach = await getCoach(headers)
  if (!coach || !(await ownsPuzzle(puzzleId, coach.id))) return null

  const link = (await findOpenLinkByPuzzle(puzzleId)).at(0)
  return link ? { url: linkUrl(link.slug) } : null
}

/**
 * Ends the sharing of one Puzzle. Nothing to answer with: the screen re-reads
 * the link afterwards, so a revoke that matched no row leaves the link
 * visibly where it was rather than reporting on a Puzzle that is not theirs.
 */
export async function revokeLink(
  puzzleId: string,
  headers: Headers
): Promise<void> {
  const coach = await getCoach(headers)
  if (!coach || !(await ownsPuzzle(puzzleId, coach.id))) return

  await revokeLinksByPuzzle(puzzleId)
}

/**
 * What a slug opens, or null — for a revoked slug and an unknown one alike,
 * so neither answer says which Puzzles exist. **No headers**: this is the one
 * read in the product that a Student makes with no session at all, and the
 * slug is the whole of the authority it carries.
 */
export async function openLink(slug: string): Promise<OpenedPuzzle | null> {
  const link = (await findOpenLinkBySlug(slug)).at(0)
  if (!link) return null

  return {
    puzzle: {
      name: link.name,
      fen: link.fen,
      goal: { kind: link.goalKind, n: link.goalN },
    },
    // Narrowed, not trusted: `board_theme` has no CHECK constraint behind it,
    // and a value the stylesheet has no palette for is sixty-four colourless
    // squares in front of a five-year-old.
    boardTheme: boardThemeOf({ boardTheme: link.boardTheme }),
  }
}
