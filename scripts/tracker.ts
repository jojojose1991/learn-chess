/**
 * The Tickets table in `docs/TRACKER.md`, written from the ticket files
 * instead of by hand. A ticket's own `Status:` line is the truth, so the index
 * over them is derived and never a second copy to keep in step: ticket 19
 * shipped and sat at `ready-for-agent` in its file for two weeks while the
 * table called it resolved, and every parallel merge conflicted on this table.
 *
 * `pnpm tracker` rewrites the two generated regions and touches nothing else
 * in the file — the carried-forward table is hand-written and stays that way,
 * because a debt has no source but the person who owed it.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { format, resolveConfig } from "prettier"

const ISSUES = ".scratch/mvp/issues"
const TRACKER = "docs/TRACKER.md"

/** The five in `docs/agents/triage-labels.md`, plus the one a finished ticket carries. */
const STATUSES = {
  resolved: "✅ resolved",
  "ready-for-agent": "⬜ ready-for-agent",
  "ready-for-human": "🙋 ready-for-human",
  "needs-triage": "❓ needs-triage",
  "needs-info": "❔ needs-info",
  wontfix: "🚫 wontfix",
} as const

export type Status = keyof typeof STATUSES

export type Ticket = {
  number: string
  title: string
  status: Status
  blockedBy: Array<string>
}

const isStatus = (value: string): value is Status => value in STATUSES

/**
 * A ticket file's own header, status and blockers.
 *
 * The title is the `#` heading rather than a short name kept here, so there is
 * nothing to edit in two places — which is the whole point of the exercise.
 */
export function parseTicket(markdown: string): Ticket {
  const heading = /^#\s+(\d{2})\s+—\s+(.+)$/m.exec(markdown)
  if (!heading) throw new Error("no `# NN — title` heading")

  const status = /^\*\*Status:\*\*\s+(\S+)\s*$/m.exec(markdown)?.[1]
  if (!status || !isStatus(status)) {
    throw new Error(`ticket ${heading[1]} has no known Status: line`)
  }

  return {
    number: heading[1],
    title: heading[2].trim(),
    status,
    blockedBy: parseBlockers(markdown),
  }
}

/**
 * The ticket numbers a ticket waits on.
 *
 * Only the first sentence is read, and only when it does not open by saying
 * there are none: three tickets say "nothing. 06 resolved, so …", and a plain
 * search for two digits reports every one of them as blocked by a ticket they
 * are explaining they do *not* wait for.
 */
export function parseBlockers(markdown: string): Array<string> {
  const paragraph = /^\*\*Blocked by:\*\*\s+([\s\S]*?)(?:\n\n|$)/m.exec(
    markdown
  )
  if (!paragraph) return []

  const sentence = paragraph[1].replace(/\s+/g, " ").split(/\.(?:\s|$)/)[0]
  if (/^(none|nothing)\b/i.test(sentence)) return []
  return [...sentence.matchAll(/\b(\d{2})\b/g)].map((match) => match[1])
}

/** A ticket nobody is waiting on, and nobody has done. */
const isReady = (ticket: Ticket, resolved: Set<string>) =>
  ticket.status === "ready-for-agent" &&
  ticket.blockedBy.every((blocker) => resolved.has(blocker))

/**
 * Resolved first, then what can be picked up, then the rest — each by number.
 *
 * The order tickets actually landed in is `git log`, not here: a column that
 * remembered it would be a second thing to maintain, which is what this file
 * is getting rid of.
 */
function order(tickets: Array<Ticket>, resolved: Set<string>) {
  const rank = (ticket: Ticket) =>
    ticket.status === "resolved" ? 0 : isReady(ticket, resolved) ? 1 : 2
  return [...tickets].sort(
    (a, b) => rank(a) - rank(b) || a.number.localeCompare(b.number)
  )
}

export function renderTable(tickets: Array<Ticket>): string {
  const resolved = new Set(
    tickets.filter((t) => t.status === "resolved").map((t) => t.number)
  )

  const rows = order(tickets, resolved).map((ticket) => {
    const status = isReady(ticket, resolved)
      ? "🟢 **ready**"
      : STATUSES[ticket.status]
    const blockers =
      ticket.status === "resolved" || ticket.blockedBy.length === 0
        ? "—"
        : ticket.blockedBy
            .map((n) => (resolved.has(n) ? `${n} ✅` : n))
            .join(", ")
    return `| ${ticket.number} | ${ticket.title} | ${status} | ${blockers} |`
  })

  return [
    "| # | Ticket | Status | Blocked by |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n")
}

const COUNTED = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven"]

/** How many are done, and what a person could pick up this minute. */
export function renderCount(tickets: Array<Ticket>): string {
  const resolved = new Set(
    tickets.filter((t) => t.status === "resolved").map((t) => t.number)
  )
  const actionable = order(tickets, resolved)
    .filter((ticket) => isReady(ticket, resolved))
    .map((ticket) => ticket.number)

  const done = `**${resolved.size} of ${tickets.length} resolved.`
  if (actionable.length === 0) return `${done} Nothing is actionable yet.**`

  const list =
    actionable.length === 1
      ? actionable[0]
      : `${actionable.slice(0, -1).join(", ")} and ${actionable.at(-1)}`
  const many = COUNTED[actionable.length] ?? String(actionable.length)
  const noun = actionable.length === 1 ? "ticket is" : "tickets are"
  return `${done} ${many} ${noun} actionable right now: ${list}.**`
}

/** The text between a region's markers, replaced. The rest of the file is nobody's business. */
export function writeRegion(file: string, name: string, body: string): string {
  const open = `<!-- tracker:${name} -->`
  const close = `<!-- /tracker:${name} -->`
  const start = file.indexOf(open)
  const end = file.indexOf(close)
  if (start === -1 || end === -1) throw new Error(`no ${name} region`)
  return file.slice(0, start + open.length) + `\n${body}\n` + file.slice(end)
}

async function main() {
  const tickets = readdirSync(ISSUES)
    .filter((name) => name.endsWith(".md"))
    .map((name) => parseTicket(readFileSync(join(ISSUES, name), "utf8")))

  let file = readFileSync(TRACKER, "utf8")
  file = writeRegion(file, "count", renderCount(tickets))
  file = writeRegion(file, "tickets", renderTable(tickets))

  // Formatted here rather than left to the commit hook: prettier pads a
  // markdown table's columns, so an unpadded write would differ from the
  // file every time and a run that changed nothing would still dirty it.
  writeFileSync(
    TRACKER,
    await format(file, {
      ...(await resolveConfig(TRACKER)),
      filepath: TRACKER,
    })
  )

  console.log(renderCount(tickets).replaceAll("**", ""))
}

// Exported for the tests; run only when this file is the one invoked.
if (process.argv[1]?.endsWith("tracker.ts")) await main()
