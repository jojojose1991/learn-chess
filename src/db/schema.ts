import { relations } from "drizzle-orm"
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import type { Goal } from "@/lib/chess/goals"
import { user } from "./auth-schema"

// `user`, `session`, `account` and `verification` are BetterAuth's own, and
// belong to its CLI. Regenerate them, never hand-edit:
//   pnpm dlx auth@1.7.2 generate --adapter drizzle --dialect postgresql \
//     --config src/lib/auth.ts --output src/db/auth-schema.ts
// The CLI needs a default-exported auth instance, so add one temporarily.
export * from "./auth-schema"

/** The two board themes (docs/PLAN.md). Low saturation, coordinates on top. */
export type BoardTheme = "green" | "brown"

/**
 * A Puzzle is a Position plus a Goal. The Position is a FEN — placement, side
 * to move, castling rights, en passant — so it is one column and not five.
 * The Goal is a kind and a number, evaluated as a predicate (ADR-0001), so no
 * solution line is ever stored.
 */
export const puzzle = pgTable(
  "puzzle",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coachId: text("coach_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    fen: text("fen").notNull(),
    goalKind: text("goal_kind").$type<Goal["kind"]>().notNull(),
    goalN: integer("goal_n").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  // The Library is every Puzzle of one Coach, by name.
  (table) => [index("puzzle_coach_id_idx").on(table.coachId)]
)

/**
 * An unlisted URL that opens one Puzzle straight into play. The theme is
 * stamped on so a Student sees the board the Coach taught on, and revoking
 * sets a timestamp rather than deleting the row.
 */
export const puzzleLink = pgTable(
  "puzzle_link",
  {
    slug: varchar("slug", { length: 8 }).primaryKey(),
    puzzleId: uuid("puzzle_id")
      .notNull()
      .references(() => puzzle.id, { onDelete: "cascade" }),
    boardTheme: text("board_theme").$type<BoardTheme>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("puzzle_link_puzzle_id_idx").on(table.puzzleId)]
)

export const puzzleRelations = relations(puzzle, ({ one, many }) => ({
  coach: one(user, { fields: [puzzle.coachId], references: [user.id] }),
  links: many(puzzleLink),
}))

export const puzzleLinkRelations = relations(puzzleLink, ({ one }) => ({
  puzzle: one(puzzle, {
    fields: [puzzleLink.puzzleId],
    references: [puzzle.id],
  }),
}))
