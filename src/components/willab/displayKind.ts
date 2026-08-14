/** Display kind over the served fields — the founder's ruling: display words
 *  only, no second taxonomy. Derived, never stored.
 *
 *  A PURE .ts MODULE, deliberately: this is founder copy (LIVE LOOP), and the
 *  taxonomy must be unit-testable — vitest here cannot transform .tsx imports
 *  (Next's `jsx: preserve`), so leaving it inside the modal made it the one
 *  piece of signed-off copy no test could reach. That is how the swap lane
 *  fell through to "Clarity" unnoticed (audit finding #7).
 */
import type { DocumentSuggestion } from "@/services/api/idealText";

export function displayKind(s: DocumentSuggestion): string {
  // The acoustic swap (founder label, 2026-08-13): this take DELIVERED a
  // locked paragraph better — the offer is about how it sounded, not the
  // words. Checked before `kind`, since a swap is kind === "replace" like an
  // ordinary correction.
  if (s.source === "acoustic_swap") return "Delivery";
  if (s.kind === "bold") return "Style";
  if (s.kind === "advice") return "Flow";
  const crossTake =
    s.why === "energy" ||
    s.why === "steadiness" ||
    s.why === "coverage" ||
    s.why === "overall";
  return crossTake ? "Flow" : "Clarity";
}
