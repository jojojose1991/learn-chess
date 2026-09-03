/**
 * The accounts policy both sides of the network need. `./index.ts` re-exports
 * from here, and those re-exports reach the browser — so nothing server-side
 * may be imported here (docs/learnings/testing.md).
 */

/**
 * BetterAuth's own default, which its `setUserPassword` enforces but its
 * `createUser` does not — so the check in `createCoach` is ours.
 */
export const MIN_PASSWORD = 8

export type NewCoach = { email: string; name: string; password: string }
export type NewPassword = { coachId: string; password: string }
export type NewAccess = { coachId: string; revoked: boolean }
