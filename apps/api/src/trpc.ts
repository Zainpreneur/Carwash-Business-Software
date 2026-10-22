/* ------------------------------------------------------------------
   Car‑wash‑SaaS – minimal tRPC bridge (no Hono router dependency yet).
   ------------------------------------------------------------------ */

/**
 * Minimal tRPC‑style bridge.
 * The web front‑end can import `trpc` and call its procedures.
 * Currently only a `health` procedure is exposed; more can be added
 * later (e.g. `onboarding`, `users.me.tenants`, etc.).
 */
export const trpc = {
  /** Returns the string "ok". */
  health: () => Promise.resolve('ok'),
};