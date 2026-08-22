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
/*     "efficiency", no percentage of a package consumed. The moment a number  */
/*     says how WELL someone is doing rather than what they BOUGHT, it is a    */
/*     performance score and it breaks AC-9. "You used 80% of your package"   */
/*     is tempting. It is banned.                                              */
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

/** "28 Aug". Used for ledger rows and dated plan state. Returns null for a
 *  missing or unparseable value so no caller prints "Invalid Date". */
export function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
}

export const TOKENS_COPY = {
  /* ------------------------------- the row ------------------------------- */

  /** The hamburger row that replaces the legacy Credits row when pricing is
   *  live. Founder 2026-07-31: the balance belongs in the menu, not the navbar
   *  — the same rule the credits row has always followed. */
  menuRowLabel: "Tokens",
  /** Value shown on the right of that row: THE NUMBER ONLY.
   *
   *  It once carried a period date. One-time purchases do not renew, and a
   *  menu row is a glance rather than a billing explanation. */
  menuRowValue: (balance: string) => balance,

  /* ------------------------------ the wallet ----------------------------- */

  /** The wallet page (the old credits/top-up page). */
  walletPageTitle: "Tokens and plans",
  walletPageIntro:
    "What you have left, what things cost, and where it went.",
  walletTier: (tier: string) => `${tier} plan`,
  walletBalanceUnknown: "Balance unavailable right now.",
  walletPricesTitle: "What things cost",
  /** The one disclosure that keeps this page a single view: prices, coach
   *  reviews and the ledger all live behind it. The plans are the point of the
   *  screen; the mechanics are reference material you go looking for. */
  walletShowMore: "Show more",
  walletShowLess: "Show less",
  walletHistoryTitle: "Recent activity",
  walletHistoryEmpty: "Nothing spent yet.",
  /** The LEDGER's pagination, which now sits inside the page-level "Show more".
   *  Two controls a few lines apart both reading "Show more" would be a coin
   *  toss for the user, so this one names what it actually fetches. */
  walletHistoryMore: "Older activity",
  walletPlansTitle: "Plans",
  /** Per-card lines. Factual, from the served tier payload — no invented
   *  marketing claims, and deliberately NO "most popular" badge: that is a
   *  claim about other users' behaviour and there is no data behind it. If the
   *  founder wants one, it should be a deliberate choice, not my default. */
  planCardTokens: (tokens: string) => `${tokens} tokens`,
  // Legacy payload fields still say `usdPerMonth`; Stripe charges once and
  // the surface must describe what the customer actually buys.
  planCardPerMonth: "one-time purchase",
  planCardReviews: (n: number) =>
    n === 0
      ? "No coach reviews"
      : n === 1
        ? "1 coach review"
        : `${n} coach reviews`,
  planCardCta: (tier: string) => `Choose ${tier}`,
  /** You are on this one already. */
  planCardCurrent: "Your plan",
  /** The free tier is never a card with a CTA — you do not check out to pay
   *  nothing. It is stated as a line so the ladder still starts somewhere. */
  planFreeLine: (tokens: string) => `Free plan: ${tokens} tokens included, no coach reviews.`,
  walletPerMonth: (usd: number) => (usd === 0 ? "Free" : `$${usd} one time`),
  walletTierTokens: (tokens: string) => `${tokens} tokens`,
  walletTierReviews: (n: number) =>
    n === 0 ? "No coach reviews" : n === 1 ? "1 coach review" : `${n} coach reviews`,
  /** Shown against the plan list because there is no subscription checkout in
   *  the product yet. Honest beats a button that goes nowhere. */
  /** The CTA on a plan you can actually buy. */
  walletChoosePlan: "Choose",
  walletChoosePlanBusy: "Opening Stripe…",
  /** Shown against the plan list when NOTHING is purchasable (Stripe or the
   *  price map unconfigured). Honest beats a button that cannot work. */
  walletUpgradeUnavailable: "Changing plan isn't available here yet.",
  /** You are already paying for this one. */
  walletCurrentPlan: "Current plan",
  /** On a paid plan already: switching and cancelling both need the billing
   *  portal, which the backend has no route for yet, so say so rather than
   *  offering a second checkout that would charge twice. */
  walletManageUnavailable:
    "To change or cancel your plan, email support and we'll sort it.",
  /** Back from Stripe. The tier arrives by webhook a moment later, so this
   *  promises an update rather than asserting a balance we cannot see yet. */
  walletPlanSuccess: "Payment received. Your new plan is being applied.",
  walletPlanCancelled: "No change made.",
  /** Back from the billing portal. Same promise-an-update shape as the
   *  checkout return: a cancellation or switch lands by webhook. */
  walletPlanManaged: "Any changes are being applied.",

  /* --------------------- the in-thread top-up card ----------------------- */

  /** Founder-signed 2026-08-13. Shown INSIDE the Lounge thread when someone
   *  has run dry — the only surface in the app that turns "out of tokens"
   *  into a route to pay. Before it, the single mention of running out was a
   *  non-clickable sentence under the record button.
   *
   *  The legacy `topUpRenews` key remains for caller compatibility, but its
   *  copy must never promise a reset for a one-time package. */
  topUpTitle: "You're out of tokens.",
  topUpRenews: (_on: string) => "Pick a package and keep going now.",
  topUpNoDate: "Pick a package and keep going now.",
  topUpChip: (tier: string, tokens: string) => `${tier} · ${tokens} tokens`,
  topUpChipPrice: (usd: number) => `$${usd}`,
  topUpDismiss: "Not now",
  topUpFailed: "Couldn't start checkout. Try again.",

  /* ------------------------ wallet read failures ------------------------- */

  /** The plans read did not come back. DISTINCT from pricing being switched
   *  off, which renders nothing at all: this one is retryable and says so,
   *  because a silent plans-less page is indistinguishable from a broken app. */
  walletLoadFailed: "Couldn't load plans right now.",
  walletRetry: "Try again",

  /* --------------------------- managing a plan --------------------------- */

  /** Stripe's billing portal: switch, cancel, fix a declined card, invoices.
   *  Shown whenever a Stripe customer exists, which OUTLIVES the subscription,
   *  so someone who cancelled can still get back to their receipts. */
  planManageCta: "Manage plan",
  /** Only when the subscription is genuinely set to end. A lapsed plan is not
   *  "ending", it has already gone, and saying otherwise dates a page wrong. */
  planEndsOn: (on: string) => `Your plan ends ${on}.`,
  planManageFailed: "Couldn't open billing. Try again.",
  /** 409 ALREADY_ON_TIER. Calm statement, no action: nothing went wrong. */
  planAlreadyOnTier: "You're already on that plan.",
  /** 409 MANAGE_EXISTING — a DIFFERENT live subscription. Routed to the portal
   *  rather than checkout, because a second Checkout Session would leave them
   *  paying for two plans at once. */
  planManageExisting: "You already have a plan. Use Manage plan to switch.",

  /* --------------------------- coach reviews ----------------------------- */

  /** A COUNT, never converted to tokens. The cap protects the founder's
   *  calendar and cannot be bought past, so there is no "buy more" here at
   *  any balance. */
  coachReviewsTitle: "Coach reviews",
  coachReviewsUsed: (used: number, allowed: number) =>
    // A zero allowance is a property of the PLAN, not a tally. "0 of 0 used"
    // reads as a broken counter, so say what is actually true.
    allowed === 0
      ? "Not included on your plan"
      : `${used} of ${allowed} used`,
  /** The one place two limits can disagree: plenty of tokens AND no reviews
   *  left. Say why plainly or it reads as a bug. */
  coachReviewsExhausted: (_renewsOn: string | null) =>
    "You've used all coach reviews included in this purchase.",

  /* ------------------------------ recording ------------------------------ */

  recordPrice: (price: string, maxMinutes: number) =>
    `${price} tokens for up to ${maxMinutes} min`,
  /** Out of tokens. No reset is promised: recording remains available and the
   *  purchase route is presented separately. */
  recordEmpty: (_renewsOn: string | null) => "You're out of tokens.",

  /* --------------------------- generic trigger --------------------------- */

  /** The bare price on a metered control. Flat and published: it never gets a
   *  clause explaining why THIS one costs what it costs. */
  actionPrice: (price: string) => `${price} tokens`,

  /* -------------------------------- unlock ------------------------------- */

  unlockPrice: (price: string) => `${price} tokens`,
  unlockInsufficient: (_renewsOn: string | null) => "Not enough tokens.",
  unlockCoachCap: (_renewsOn: string | null) =>
    "You've used all coach reviews included in this purchase.",
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
