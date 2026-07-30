import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  tokens — the metered-wallet reads (token pricing, Phase 1)                 */
/*                                                                            */
/*  Four authed, read-only endpoints. NONE of them charge: charging happens    */
/*  at the action being paid for, so polling a balance is always free and we   */
/*  can refresh it as often as the UI wants.                                   */
/*                                                                            */
/*  THREE RULES THIS MODULE EXISTS TO ENFORCE:                                 */
/*                                                                            */
/*  1. `enabled` FIRST, ALWAYS. Flag off → every endpoint answers 200          */
/*     {"enabled": false} rather than 404, precisely so one probe separates    */
/*     "pricing is off, render NO wallet UI at all" from "the backend broke".  */
/*     A 404 cannot carry that difference. Off is a first-class state here     */
/*     ("off"), and it means render nothing — never a zeroed wallet.           */
/*                                                                            */
/*  2. `available: false` means UNKNOWN, never zero. The account could not be  */
/*     read. Showing zero would hide the record button over a failed lookup,   */
/*     so "unknown" renders the previous value or nothing and keeps every      */
/*     action enabled. Every parse failure and every network error also lands  */
/*     on "unknown" for the same reason: this wallet fails OPEN.               */
/*                                                                            */
/*  3. NEVER HARDCODE A PRICE. Prices get re-set once the cost measurements    */
/*     land — that is the whole point of serving them — and a literal 1000     */
/*     anywhere in the FE silently pins a number the founder needs to move     */
/*     without a deploy. `price_version` rides along so a stale cached list    */
/*     is diagnosable rather than invisible.                                   */
/* -------------------------------------------------------------------------- */

/* -------------------------------- helpers -------------------------------- */

function isEnabled(raw: unknown): raw is Record<string, unknown> {
  return !!raw && typeof raw === "object" && (raw as Record<string, unknown>).enabled === true;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/* -------------------------------- balance -------------------------------- */

export interface CoachReviewAllowance {
  used: number;
  allowed: number;
  remaining: number;
}

export type TokenBalance =
  /** Pricing is off. Render no wallet UI at all — not a zeroed one. */
  | { kind: "off" }
  /** Unreadable (available:false, malformed, or unreachable). NOT zero: hold
   *  the last known value or show nothing, and keep every action enabled. */
  | { kind: "unknown" }
  | {
      kind: "ready";
      balance: number;
      tier: string | null;
      periodStart: string | null;
      /** Load-bearing, not decoration: without it a falling balance reads as a
       *  countdown to being locked out rather than "wait or top up". */
      periodEndsAt: string | null;
      /** A SEPARATE counter from tokens, and never convertible to them. */
      coachReviews: CoachReviewAllowance | null;
    };

export function mapTokenBalance(raw: unknown): TokenBalance {
  if (!isEnabled(raw)) return { kind: "off" };
  // available:false is the documented "could not read the account" signal.
  if (raw.available === false) return { kind: "unknown" };
  const balance = num(raw.balance);
  // No number to show is the same situation as an explicit available:false.
  if (balance === null) return { kind: "unknown" };

  const cr = raw.coach_reviews as Record<string, unknown> | undefined;
  const used = num(cr?.used);
  const allowed = num(cr?.allowed);
  const remaining = num(cr?.remaining);

  return {
    kind: "ready",
    balance,
    tier: str(raw.tier),
    periodStart: str(raw.period_start),
    periodEndsAt: str(raw.period_ends_at),
    coachReviews:
      used !== null && allowed !== null
        ? { used, allowed, remaining: remaining ?? Math.max(0, allowed - used) }
        : null,
  };
}

export async function fetchTokenBalance(): Promise<TokenBalance> {
  return getJson("/api/v2/tokens/balance", mapTokenBalance, { kind: "unknown" });
}

/** What to display after a refresh lands.
 *
 *  An unreadable read must NOT erase a good one. "Unknown" means we do not
 *  know, and the last known number is a better thing to show than a blank —
 *  otherwise one flaky poll blanks the chip mid-session and reads to the user
 *  as though something just spent their balance. Every other transition takes
 *  the new value, including a genuine drop to zero and a flag that has been
 *  turned off underneath us. */
export function nextBalance(prev: TokenBalance, incoming: TokenBalance): TokenBalance {
  return incoming.kind === "unknown" && prev.kind === "ready" ? prev : incoming;
}

/* -------------------------------- prices --------------------------------- */

export interface TokenBand {
  maxSeconds: number;
  action: string;
  price: number;
}

export interface TokenTier {
  tokensPerMonth: number;
  coachReviewsPerMonth: number;
  usdPerMonth: number;
}

export interface TokenPrices {
  /** Tells you when a cached list is stale. Surfaced in the wallet so a wrong
   *  price is traceable to a version rather than guessed at. */
  priceVersion: string | null;
  /** action key → price. Read through `priceOf`; never inline a number. */
  actions: Record<string, number>;
  /** Ascending by maxSeconds — `bandFor` relies on the order. */
  bands: TokenBand[];
  tiers: Record<string, TokenTier>;
}

export function mapTokenPrices(raw: unknown): TokenPrices | null {
  if (!isEnabled(raw)) return null;

  const actions: Record<string, number> = {};
  const rawActions = raw.actions;
  if (rawActions && typeof rawActions === "object") {
    for (const [k, v] of Object.entries(rawActions as Record<string, unknown>)) {
      const n = num(v);
      if (n !== null) actions[k] = n;
    }
  }

  const bands: TokenBand[] = [];
  if (Array.isArray(raw.bands)) {
    for (const b of raw.bands as Record<string, unknown>[]) {
      const maxSeconds = num(b?.max_seconds);
      const price = num(b?.price);
      const action = str(b?.action);
      if (maxSeconds !== null && price !== null && action !== null) {
        bands.push({ maxSeconds, action, price });
      }
    }
    bands.sort((a, b) => a.maxSeconds - b.maxSeconds);
  }

  const tiers: Record<string, TokenTier> = {};
  if (raw.tiers && typeof raw.tiers === "object") {
    for (const [k, v] of Object.entries(raw.tiers as Record<string, unknown>)) {
      const t = v as Record<string, unknown>;
      const tokensPerMonth = num(t?.tokens_per_month);
      const usdPerMonth = num(t?.usd_per_month);
      if (tokensPerMonth === null || usdPerMonth === null) continue;
      tiers[k] = {
        tokensPerMonth,
        coachReviewsPerMonth: num(t?.coach_reviews_per_month) ?? 0,
        usdPerMonth,
      };
    }
  }

  return { priceVersion: str(raw.price_version), actions, bands, tiers };
}

/** The price of a named action, or null when the BE did not publish one.
 *  Null means "show no price", never "free" and never a guessed default. */
export function priceOf(prices: TokenPrices | null, action: string): number | null {
  if (!prices) return null;
  const p = prices.actions[action];
  return typeof p === "number" ? p : null;
}

/** The band a take of `seconds` lands in — the FIRST band whose cap it fits.
 *  Past the last band there is no higher price to quote, so the top band is
 *  returned: the BE charges what it charges, and quoting the top band is the
 *  honest ceiling rather than a made-up number. */
export function bandFor(prices: TokenPrices | null, seconds: number | null): TokenBand | null {
  if (!prices || prices.bands.length === 0) return null;
  if (seconds === null) return prices.bands[prices.bands.length - 1];
  return (
    prices.bands.find((b) => seconds <= b.maxSeconds) ?? prices.bands[prices.bands.length - 1]
  );
}

/** Cached for the page's lifetime: prices do not move mid-session and several
 *  surfaces read them. `price_version` is what catches a genuinely stale list. */
let pricesCache: Promise<TokenPrices | null> | null = null;

export function fetchTokenPrices(): Promise<TokenPrices | null> {
  pricesCache ??= getJson("/api/v2/tokens/prices", mapTokenPrices, null);
  return pricesCache;
}

/** Tests only — drop the memoised read. */
export function resetTokenPricesCache(): void {
  pricesCache = null;
}

/* ---------------------------- recording band ----------------------------- */

export type RecordingBandState =
  | { kind: "off" }
  | { kind: "unknown" }
  | {
      kind: "priced";
      /** ADVISORY. The recorder may suggest it; it must never truncate or
       *  discard a take over it. An overrun uploads and charges the band the
       *  audio actually landed in. */
      maxSeconds: number;
      action: string;
      price: number;
      balance: number | null;
      periodEndsAt: string | null;
    }
  /** Out of tokens (can_record:false).
   *
   *  THIS IS NOT A BLOCK. Takes charge silently and fail open BE-side, so a
   *  recording started at zero still produces a transcript. Callers show the
   *  upgrade-or-renewal offer and LEAVE RECORDING ENABLED — losing someone's
   *  take is worse than any billing inaccuracy, and gating the record button
   *  on a balance read is exactly how the live loop breaks. */
  | { kind: "exhausted"; balance: number | null; periodEndsAt: string | null };

export function mapRecordingBand(raw: unknown): RecordingBandState {
  if (!isEnabled(raw)) return { kind: "off" };
  const balance = num(raw.balance);
  const periodEndsAt = str(raw.period_ends_at);
  if (raw.can_record === false) return { kind: "exhausted", balance, periodEndsAt };

  const maxSeconds = num(raw.max_seconds);
  const price = num(raw.price);
  const action = str(raw.action);
  // can_record:true but no quotable band — treat as unknown so the recorder
  // shows no price rather than a wrong one. Recording stays enabled either way.
  if (maxSeconds === null || price === null || action === null) return { kind: "unknown" };

  return { kind: "priced", maxSeconds, action, price, balance, periodEndsAt };
}

export async function fetchRecordingBand(): Promise<RecordingBandState> {
  return getJson("/api/v2/tokens/recording-band", mapRecordingBand, { kind: "unknown" });
}

/* -------------------------------- history -------------------------------- */

export interface TokenLedgerEntry {
  id: number;
  /** Negative for a spend. Rendered as-is; never re-derived from a balance. */
  delta: number;
  balanceAfter: number | null;
  action: string | null;
  refId: string | null;
  tier: string | null;
  createdAt: string | null;
}

export type TokenHistory =
  | { kind: "off" }
  | { kind: "unknown" }
  | { kind: "ready"; entries: TokenLedgerEntry[]; nextBeforeId: number | null };

export function mapTokenHistory(raw: unknown): TokenHistory {
  if (!isEnabled(raw)) return { kind: "off" };
  if (!Array.isArray(raw.entries)) return { kind: "unknown" };
  const entries: TokenLedgerEntry[] = [];
  for (const e of raw.entries as Record<string, unknown>[]) {
    const id = num(e?.id);
    const delta = num(e?.delta);
    if (id === null || delta === null) continue;
    entries.push({
      id,
      delta,
      balanceAfter: num(e?.balance_after),
      action: str(e?.action),
      refId: str(e?.ref_id),
      tier: str(e?.tier),
      createdAt: str(e?.created_at),
    });
  }
  return { kind: "ready", entries, nextBeforeId: num(raw.next_before_id) };
}

export async function fetchTokenHistory(opts?: {
  limit?: number;
  beforeId?: number | null;
}): Promise<TokenHistory> {
  const qs = new URLSearchParams();
  if (opts?.limit != null) qs.set("limit", String(opts.limit));
  if (opts?.beforeId != null) qs.set("before_id", String(opts.beforeId));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return getJson(`/api/v2/tokens/history${suffix}`, mapTokenHistory, { kind: "unknown" });
}

/* --------------------------------- fetch --------------------------------- */

/** One authed GET + map, with every failure funnelled to the caller's chosen
 *  fail-open value. Signed out is `fallback` too, not "off": a missing token
 *  says nothing about whether pricing is enabled. */
async function getJson<T>(
  url: string,
  map: (raw: unknown) => T,
  fallback: T
): Promise<T> {
  const token = await getAuthToken();
  if (!token) return fallback;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return fallback;
    return map(await res.json());
  } catch {
    return fallback;
  }
}
