/**
 * Question-attribution helpers — pure functions for reading the
 * `source` / `directive` envelope BE-3 attaches to next-question
 * responses (`/v2/public/interview/next-question`,
 * `/v2/user/chat/first-question`).
 *
 * Backend shape (see routes/v2_routes.py):
 *
 *   {
 *     question: string,
 *     tone: "charisma" | "stress",
 *     turn_number: number,
 *     source: "directives_queue" | "admin_override" | "llm_generated",
 *     directive?: { position: number, intent_tag: string }   // only when
 *                                                            // source ===
 *                                                            // "directives_queue"
 *   }
 *
 * The user-facing chat surface does NOT render this metadata directly
 * (admin steering is intentionally invisible to the end user). But:
 *
 *  - Dev-time visibility: every admin-influenced turn emits a
 *    structured console.info so engineering can grep production
 *    sessions for "this turn was admin-driven."
 *  - Admin transcript view: the same `describeQuestionSource` string
 *    can later be wired into the admin chat-transcript renderer as a
 *    subtle inline badge ("admin · directive #2 (probe)") so the
 *    admin sees which questions they were steering. Out of scope for
 *    the FE-07 probe-close commit; helper is exported now so it can
 *    be reused without re-implementing the source-typing logic.
 */

export type NextQuestionSource =
  | "directives_queue"
  | "admin_override"
  | "llm_generated";

export interface NextQuestionAttribution {
  source: NextQuestionSource;
  directive?: { position: number; intent_tag: string };
}

/**
 * Compose a single human-readable label for the question's
 * provenance. Returns null when the source is `"llm_generated"` —
 * the default path, no attribution to show. Used by the dev console
 * logger and (in a follow-up) by the admin transcript renderer.
 */
export function describeQuestionSource(
  attribution: NextQuestionAttribution
): string | null {
  switch (attribution.source) {
    case "directives_queue": {
      const d = attribution.directive;
      if (d && typeof d.position === "number") {
        const tag = d.intent_tag?.trim();
        return tag
          ? `admin · directive #${d.position} (${tag})`
          : `admin · directive #${d.position}`;
      }
      return "admin · directive";
    }
    case "admin_override":
      return "admin · override";
    case "llm_generated":
      return null;
    default: {
      // Unknown source — TypeScript-level exhaustiveness catches
      // adds at compile time, but if backend ever ships a new source
      // string without bumping the FE, surface the unknown value so
      // engineering can grep the logs.
      const unknown = attribution.source as string;
      console.warn(
        `questionAttribution: unknown source="${unknown}" — ` +
          `expected one of directives_queue / admin_override / llm_generated. ` +
          `Update NextQuestionSource enum.`
      );
      return `unknown source: ${unknown}`;
    }
  }
}

/**
 * Side-effect-only logger used by ChatInterview on every
 * fetchNextQuestion response. Emits a structured console.info when
 * the question came from an admin-side path so dev / production
 * console searches can find the turn. No-op for LLM-generated
 * questions (the default — no signal to surface).
 */
export function logQuestionAttribution(
  attribution: NextQuestionAttribution,
  turnNumber: number
): void {
  const label = describeQuestionSource(attribution);
  if (!label) return;
  // Structured prefix keeps `console.info` lines greppable across
  // a noisy chat log. The directive object is logged separately so
  // the position + intent_tag are inspectable as keyed fields.
  console.info(
    `[next-question attribution] turn=${turnNumber} ${label}`,
    attribution.directive ?? null
  );
}
