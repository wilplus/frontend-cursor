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
  // MVP machine feedback is intentionally framed as a possibility. Candidate
  // selection lowers the threshold for what is worth inspecting, never the
  // threshold for declaring the speaker definitively strong or wrong.
  if (s.feedbackFamily === "confident_voice") return "Possible confident moment";
  if (s.feedbackFamily === "great_formulation") return "Possible strong formulation";
  if (s.feedbackFamily === "rewrite_clarity") return "Possible clarity improvement";
  // The acoustic swap (founder label, 2026-08-13): this take DELIVERED a
  // locked paragraph better — the offer is about how it sounded, not the
  // words. Checked before `kind`, since a swap is kind === "replace" like an
  // ordinary correction.
  if (s.source === "acoustic_swap") return "Delivery";
  // BEFORE kind too — the Confident Voice card is kind='bold' on the wire
  // (§17 acoustic-confidence-v1, founder 2026-08-14).
  if (s.source === "confident_voice") return "Confident Voice";
  if (s.kind === "bold") return "Style";
  // THE PRAISE LANE (founder 2026-08-15). Before the generic advice label:
  // every other `advice` device is a note to work on and "Flow" reads as one,
  // so praise wearing that title would land as a criticism the student then
  // has to read past. It is the same reason Confident Voice has its own title
  // rather than sitting under "Style".
  if (s.device === "impeccable") return "Well said";
  if (s.kind === "advice") return "Flow";
  const crossTake =
    s.why === "energy" ||
    s.why === "steadiness" ||
    s.why === "coverage" ||
    s.why === "overall";
  return crossTake ? "Flow" : "Clarity";
}
