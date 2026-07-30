/* -------------------------------------------------------------------------- */
/*  ⚠️  PLACEHOLDER COPY — EVERY STRING IN THIS FILE AWAITS FOUNDER SIGN-OFF   */
/*                                                                            */
/*  The mechanics of token pricing ship; the words do not. All of it lives in  */
/*  one file so sign-off is a single review rather than a hunt through ten     */
/*  components, and so a rewrite touches no logic.                             */
/*                                                                            */
/*  THE TWO RULES THESE STRINGS ARE WRITTEN AGAINST — any replacement has to   */
/*  hold them too, so they are here and not only in the handoff:               */
/*                                                                            */
/*  1. THIS IS A WALLET, NOT A PROGRESS BAR. No streaks, no "you've earned",   */
/*     no badge for spending little, no comparison to other users, no          */
/*     "efficiency", no percentage of the month consumed. The moment a number  */
/*     says how WELL someone is doing rather than what they BOUGHT, it is a    */
/*     performance score and it breaks AC-9. The monthly reset makes           */
/*     "you used 80% of your month!" tempting. It is banned.                   */
/*                                                                            */
/*  2. NEVER EXPLAIN A PRICE WITH QUALITY. "This take costs 3,000" is fine.    */
/*     Anything of the form "cost more because <their delivery>" is forbidden. */
/*     Prices are flat, published, and vary only by a duration band the user   */
/*     picks BEFORE recording.                                                 */
/*                                                                            */
/*  House style: no em-dashes in user-facing copy.                            */
/* -------------------------------------------------------------------------- */

/** Thousands-separated, e.g. 41500 → "41,500". Locale-fixed so a screenshot
 *  from any machine matches the copy that was signed off. */
export function formatTokens(n: number): string {
  return new Intl.NumberFormat("en-GB").format(n);
}

/** "28 Aug". Used for the renewal date and for ledger rows, so the two can
 *  never render a date two different ways. Returns null for a missing or
 *  unparseable value, and every caller drops the clause rather than printing
 *  "renews Invalid Date". */
export function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
}

export const TOKENS_COPY = {
  /* ------------------------------- the chip ------------------------------ */

  /** The renewal date is load-bearing, not decoration: without it a user who
   *  watches the number fall has no idea it comes back, and a falling balance
   *  reads as a countdown to being locked out. With it, low is "wait or top
   *  up". Never drop the clause to save space. */
  chip: (balance: string, renewsOn: string | null) =>
    renewsOn ? `${balance} · renews ${renewsOn}` : balance,
  chipLabel: "Your token balance",

  /* ------------------------------ the wallet ----------------------------- */

  walletTitle: "Tokens",
  walletTier: (tier: string) => `${tier} plan`,
  walletRenews: (on: string) => `Renews ${on}`,
  walletRenewsUnknown: "Renews monthly",
  walletBalanceUnknown: "Balance unavailable right now.",
  walletPricesTitle: "What things cost",
  walletHistoryTitle: "Recent activity",
  walletHistoryEmpty: "Nothing spent yet.",
  walletHistoryMore: "Show more",
  walletPlansTitle: "Plans",
  walletPerMonth: (usd: number) => (usd === 0 ? "Free" : `$${usd} / month`),
  walletTierTokens: (tokens: string) => `${tokens} tokens a month`,
  walletTierReviews: (n: number) =>
    n === 0 ? "No coach reviews" : n === 1 ? "1 coach review a month" : `${n} coach reviews a month`,
  /** Shown against the plan list because there is no subscription checkout in
   *  the product yet. Honest beats a button that goes nowhere. */
  walletUpgradeUnavailable: "Changing plan isn't available here yet.",

  /* --------------------------- coach reviews ----------------------------- */

  /** A COUNT, never converted to tokens. The cap protects the founder's
   *  calendar and cannot be bought past, so there is no "buy more" here at
   *  any balance. */
  coachReviewsTitle: "Coach reviews",
  coachReviewsUsed: (used: number, allowed: number) => `${used} of ${allowed} used this month`,
  /** The one place two limits can disagree: plenty of tokens AND no reviews
   *  left. Say why plainly or it reads as a bug. */
  coachReviewsExhausted: (renewsOn: string | null) =>
    renewsOn
      ? `You've used your coach reviews for this month. They renew ${renewsOn}.`
      : "You've used your coach reviews for this month.",

  /* ------------------------------ recording ------------------------------ */

  recordPrice: (price: string, maxMinutes: number) =>
    `${price} tokens for up to ${maxMinutes} min`,
  /** Out of tokens. Offers BOTH the plan route and the wait route, always:
   *  with a monthly reset, waiting is a legitimate choice and hiding it is a
   *  dark pattern. Recording itself stays available. */
  recordEmpty: (renewsOn: string | null) =>
    renewsOn
      ? `You're out of tokens. They renew ${renewsOn}.`
      : "You're out of tokens.",

  /* --------------------------- generic trigger --------------------------- */

  /** The bare price on a metered control. Flat and published: it never gets a
   *  clause explaining why THIS one costs what it costs. */
  actionPrice: (price: string) => `${price} tokens`,

  /* -------------------------------- unlock ------------------------------- */

  unlockPrice: (price: string) => `${price} tokens`,
  unlockInsufficient: (renewsOn: string | null) =>
    renewsOn
      ? `Not enough tokens. Yours renew ${renewsOn}.`
      : "Not enough tokens.",
  unlockCoachCap: (renewsOn: string | null) =>
    renewsOn
      ? `You've used your coach reviews for this month. They renew ${renewsOn}.`
      : "You've used your coach reviews for this month.",
} as const;

/* ------------------------- action → human label --------------------------- */

/** Labels for the action keys the price list and ledger show. A key we don't
 *  know is humanised rather than dropped: the BE owns this list, and a new
 *  action must not vanish from the ledger because the FE hasn't heard of it. */
const ACTION_LABELS: Record<string, string> = {
  take_short: "Short take",
  take_medium: "Medium take",
  take_long: "Long take",
  reread: "Re-read",
  assembly: "Assembly",
  moment_explanation: "Key moment explanation",
  game: "Game",
  insights: "Insights",
  chat: "Chat",
  coach_review: "Coach review",
};

export function actionLabel(action: string | null): string {
  if (!action) return "Activity";
  return (
    ACTION_LABELS[action] ??
    action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
  );
}
