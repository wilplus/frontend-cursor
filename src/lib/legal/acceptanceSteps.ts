import type { ProcessingPolicy } from "@/services/api/processingAuthorization";

/* -------------------------------------------------------------------------- */
/*  The acceptance screen's rules, separated from its rendering (Task 5;       */
/*  one screen since founder 2026-10-18).                                      */
/*                                                                            */
/*  Same reason policyText.ts exists next door: vitest cannot transform .tsx,  */
/*  so a rule left inside a component is a rule no unit test can reach. These  */
/*  are the rules that decide whether a receipt may be created at all, so they */
/*  are exactly the ones that need tests.                                      */
/* -------------------------------------------------------------------------- */

/** The three documents, in the order their links sit on the screen. They
 *  open in a window from the one acceptance screen (founder 2026-10-18):
 *  GDPR Art 13 information has to be AVAILABLE before the processing is
 *  agreed to, which a link next to the decision is; it does not have to be
 *  walked through. */
export type DocumentKey = "terms" | "privacy" | "ai";

export const DOCUMENT_ORDER: readonly DocumentKey[] = ["terms", "privacy", "ai"];

export interface CountryChoice {
  /** Lowercase, exactly as the policy stores it. */
  code: string;
  /** Localised country name, or the uppercase code when the runtime has no
   *  name for it. Never a region or a grouping — see countryChoices. */
  label: string;
}

/** Shown first, always, whatever the reader's device language is.
 *
 *  Not a default and not a guess about anyone: the product is operated from
 *  Poland and most people choosing here live there, so it is the row that
 *  should not require scrolling past twenty-six others to reach. It still has
 *  to be chosen — nothing is preselected, because the receipt records which
 *  country's law a person accepted under and that may not be assumed. (The
 *  one exception is the person's OWN earlier answer: see prefilledCountry.)
 */
const FIRST_CHOICE = "pl";

/** Shown second, right below Poland (founder 2026-10-15: "add it below
 *  Poland"), when the policy in force allows it. Pinned for the same reason
 *  as Poland, and likewise never preselected. */
const SECOND_CHOICE = "us";

const PINNED = [FIRST_CHOICE, SECOND_CHOICE];

/** The country to show already chosen: the person's own answer from their
 *  last acceptance, when the policy in force still allows it.
 *
 *  Founder 2026-10-05 (N48.4 Q21 A): country is asked once and prefilled on
 *  every later re-acceptance. Not a guess and not a default for anyone else:
 *  it is what this person said, shown chosen on the same step, and still
 *  theirs to change before they agree. A country the new policy no longer
 *  allows is not prefilled — sending it would be refused (COUNTRY_NOT_ALLOWED)
 *  — so the step is simply asked again. */
export function prefilledCountry(
  policy: ProcessingPolicy,
  prior: string | null | undefined,
): string | null {
  const code = (prior ?? "").trim().toLowerCase();
  if (!code) return null;
  return policy.allowedCountries.some((c) => c.trim().toLowerCase() === code)
    ? code
    : null;
}

/** The reader's locale if Intl accepts it, else "en".
 *
 *  `navigator.language` is not guaranteed to be a BCP 47 tag: a browser that
 *  inherits a POSIX `LANG` reports "en-US@posix", and `localeCompare` THROWS
 *  a RangeError on it — which took the whole acceptance flow to the error
 *  boundary, so the person could never agree and recording stayed closed.
 *  Validated once here so the names and the sort read the same tag. */
export function safeLocale(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? "en";
  } catch {
    return "en";
  }
}

/** One row per allowed country, named in the reader's own language,
 *  Poland first, then the United States.
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
  // NAMED IN THE READER'S OWN LANGUAGE, and that is the point of the pin
  // (founder 2026-09-20: "keep the languages being dynamically assigned...
  // just pin Poland first, no matter what the language"). Poland is
  // Pologne, Polen, Polonia or Polska depending on the device, and lands in
  // a different alphabetical position in each — which is exactly why it
  // cannot be found by sorting, and has to be pinned instead.
  const tag = safeLocale(locale);
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([tag], { type: "region" });
  } catch {
    names = null;
  }
  const seen = new Set<string>();
  const rows: CountryChoice[] = [];
  for (const raw of policy.allowedCountries) {
    const code = raw.trim().toLowerCase();
    // ONE ROW PER COUNTRY. A duplicate in `allowed_countries` would otherwise
    // render twice, and the pinned row below would render a third time.
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const upper = code.toUpperCase();
    let label = upper;
    try {
      label = names?.of(upper) ?? upper;
    } catch {
      label = upper;
    }
    // The United States is open to California residents only (Terms 3.6
    // §4, founder 2026-10-15, WIL-7), so the row says so: the code stays
    // 'us', which is what the policy allows and the receipt records.
    if (code === SECOND_CHOICE) label = `${label} (California)`;
    rows.push({ code, label });
  }
  // PARTITION, NOT A SPECIAL CASE IN THE COMPARATOR. A comparator that treats
  // one element as always-smaller is not a total order, and the sort it feeds
  // is free to disagree with itself. Splitting the list says the same thing
  // and cannot.
  const pinned = PINNED.flatMap((code) => rows.filter((row) => row.code === code));
  const rest = rows
    .filter((row) => !PINNED.includes(row.code))
    .sort((a, b) => a.label.localeCompare(b.label, tag));
  return [...pinned, ...rest];
}

export interface ConfirmState {
  /** The code the user picked, or null before they pick. */
  country: string | null;
  /** Art 9(2)(a) — the separate explicit consent for what a voice can reveal. */
  sensitiveAttested: boolean;
}

/** Whether "Agree and continue" may be pressed.
 *
 *  THE TICK AND THE COUNTRY, SEPARATELY. The age and the Terms are accepted
 *  by the button itself, as the agreement text above it says (founder
 *  2026-10-18); the recordings tick is the Art 9(2)(a) explicit consent and
 *  Art 7(4) is the reason it cannot be folded into that button. The country
 *  is required because the receipt records which law was accepted under.
 */
export function canSubmit(
  state: ConfirmState,
  policy: ProcessingPolicy,
): boolean {
  if (!state.sensitiveAttested) return false;
  if (!state.country) return false;
  return policy.allowedCountries.includes(state.country);
}
