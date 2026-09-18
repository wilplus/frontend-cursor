import type { ProcessingPolicy } from "@/services/api/processingAuthorization";

/* -------------------------------------------------------------------------- */
/*  The acceptance screen's rules, separated from its rendering (Task 5).      */
/*                                                                            */
/*  Same reason policyText.ts exists next door: vitest cannot transform .tsx,  */
/*  so a rule left inside a component is a rule no unit test can reach. These  */
/*  are the rules that decide whether a receipt may be created at all, so they */
/*  are exactly the ones that need tests.                                      */
/* -------------------------------------------------------------------------- */

export type Step = "notice" | "terms" | "privacy" | "ai" | "country" | "confirm";

/** The order a first-time user walks. The three documents sit BETWEEN the
 *  notice and the decision on purpose: GDPR Art 13 information has to be given
 *  before the processing is agreed to, not linked underneath the button. */
export const STEP_ORDER: readonly Step[] = [
  "notice",
  "terms",
  "privacy",
  "ai",
  "country",
  "confirm",
];

export function nextStep(step: Step): Step {
  const at = STEP_ORDER.indexOf(step);
  return at >= 0 && at < STEP_ORDER.length - 1 ? STEP_ORDER[at + 1] : step;
}

export function previousStep(step: Step): Step {
  const at = STEP_ORDER.indexOf(step);
  return at > 0 ? STEP_ORDER[at - 1] : step;
}

export interface CountryChoice {
  /** Lowercase, exactly as the policy stores it. */
  code: string;
  /** Localised country name, or the uppercase code when the runtime has no
   *  name for it. Never a region or a grouping — see countryChoices. */
  label: string;
}

/** One row per allowed country, named in the reader's own language.
 *
 *  NO REGION ROWS, EVER. `allowed_countries` holds individual lowercase codes
 *  and `accept_phase1_processing_authorization_v1` compares what we send
 *  against that array character for character, raising COUNTRY_NOT_ALLOWED
 *  otherwise. A convenience row like "Another EU country" has no code to send,
 *  and the receipt would lose the one fact it exists to record: which
 *  country's law the user accepted under.
 */
export function countryChoices(
  policy: ProcessingPolicy,
  locale: string,
): CountryChoice[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    names = null;
  }
  return policy.allowedCountries
    .map((code) => {
      const upper = code.trim().toUpperCase();
      let label = upper;
      try {
        label = names?.of(upper) ?? upper;
      } catch {
        label = upper;
      }
      return { code: code.trim().toLowerCase(), label };
    })
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

export interface ConfirmState {
  /** The code the user picked, or null before they pick. */
  country: string | null;
  /** Art 8 / Terms §2 — the policy's own minimum, not a constant here. */
  ageAttested: boolean;
  /** Art 9(2)(a) — the separate explicit consent for what a voice can reveal. */
  sensitiveAttested: boolean;
}

/** Whether "Agree and continue" may be pressed.
 *
 *  ALL THREE, SEPARATELY. The two attestations are not one checkbox split in
 *  half for looks: the first is a contract condition and the second is the
 *  Art 9(2)(a) explicit consent, and Art 7(4) is the reason they cannot be
 *  bundled into a single tick. The country is required because the receipt
 *  records which law was accepted under.
 */
export function canSubmit(
  state: ConfirmState,
  policy: ProcessingPolicy,
): boolean {
  if (!state.ageAttested || !state.sensitiveAttested) return false;
  if (!state.country) return false;
  return policy.allowedCountries.includes(state.country);
}

/** Every document has been opened at least once.
 *
 *  Used to TICK the rows, never to gate the button. The law requires the
 *  documents be available before the decision, not that we prove someone read
 *  them — and a Continue that refuses until three panes have been opened
 *  teaches people to tap through three panes.
 */
export function allDocumentsSeen(seen: ReadonlySet<Step>): boolean {
  return seen.has("terms") && seen.has("privacy") && seen.has("ai");
}
