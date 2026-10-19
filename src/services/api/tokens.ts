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

/* ONE BALANCE READ PER PAGE, SHARED (founder 2026-10-16). The header's chip
   and the Lounge's top-up card each mount a wallet, and each wallet re-read
   on focus AND on visibilitychange, so a signed-in open paid the balance
   endpoint four times and a tab switch four more. One in-flight promise now
   serves every wallet for a short window; a spend drops it, so the chip
   never re-serves the pre-purchase number. Same shape as the shared profile
   read (userProfile.ts). */
const SHARED_BALANCE_TTL_MS = 10_000;
let sharedBalance: { at: number; promise: Promise<TokenBalance> } | null = null;

/** The balance, from the shared read when one is fresh. */
export function fetchTokenBalanceShared(): Promise<TokenBalance> {
  const now = Date.now();
  if (sharedBalance && now - sharedBalance.at < SHARED_BALANCE_TTL_MS) {
    return sharedBalance.promise;
  }
  const promise = fetchTokenBalance();
  sharedBalance = { at: now, promise };
  // An unreadable balance is not worth sharing: the next caller asks again.
  void promise.then((b) => {
    if (b.kind === "unknown" && sharedBalance?.promise === promise) sharedBalance = null;
  });
  return promise;
}

/** Forget the shared read (after a spend, or when the account changes). */
export function forgetSharedTokenBalance(): void {
  sharedBalance = null;
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
  /** action key → price; never inline a number. */
  actions: Record<string, number>;
  /** Ascending by maxSeconds. */
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

/** The prices probe, with FAILURE SEPARATED FROM OFF.
 *
 *  Both used to collapse to `null`, and that one missing distinction is what
 *  made "/dashboard/pricing didn't open" indistinguishable from "pricing is
 *  switched off" and from "the network blipped" — the page rendered a
 *  plans-less wallet either way, with no error and no retry.
 *
 *    "off"    — the BE answered {"enabled": false}. Deliberate: render NO
 *               wallet UI at all. Not an error, nothing to retry.
 *    "failed" — we could not get an answer (HTTP error, network, bad JSON).
 *               The user gets a retry, because trying again may well work.
 *    "ready"  — the published list. */
export type TokenPricesRead =
  | { kind: "ready"; prices: TokenPrices }
  | { kind: "off" }
  | { kind: "failed" };

/** Cached for the page's lifetime: prices do not move mid-session and several
 *  surfaces read them. `price_version` is what catches a genuinely stale list.
 *
 *  A FAILED read is cached too, which is why `resetTokenPricesCache` is part
 *  of the retry path rather than a test-only hook: without clearing it, one
 *  flaky moment pinned a plans-less wallet until a hard reload, since
 *  client-side navigation never re-runs this. */
let pricesCache: Promise<TokenPricesRead> | null = null;

/* REMEMBERED ACROSS PAGE LOADS (founder 2026-10-18). The read measured a
   full second in the browser, of which the backend's own work was nil: the
   rest was a Vercel cold boot and the hop to Railway, which no code in this
   file can shorten. What it CAN do is stop waiting for them. The list is
   static per backend deploy — it moves with `price_version`, never
   mid-session, and it is the same for every account — so the last published
   body is kept in localStorage and served FIRST on the next open: the
   pricing page, the wallet panel and the top-up card paint their prices
   with no round trip, and the read still goes out behind the paint. A
   changed list, or the flag turned off, replaces what was shown through
   `subscribeTokenPrices`; a failed read keeps it, because the last known
   list beats a blank, exactly as a balance read does. Same shape as
   idealTitleCache: stale-while-revalidate on a value whose staleness is
   invisible, and best-effort throughout (private mode, quota, disabled
   storage all fall back to the plain read). */
const STORED_PRICES_KEY = "willab.tokenPrices";

type PricesListener = (read: TokenPricesRead) => void;
const listeners = new Set<PricesListener>();

/** Be told when a read served from the stored copy is replaced by a fresher
 *  answer. The wallet hook applies it to its state. */
export function subscribeTokenPrices(listener: PricesListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStoredPricesText(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORED_PRICES_KEY);
  } catch {
    return null;
  }
}

function rememberPricesText(text: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORED_PRICES_KEY, text);
  } catch {
    /* quota / private mode / storage disabled — this session is served
       from memory and the next one falls back to the fetch. */
  }
}

function forgetStoredPrices(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORED_PRICES_KEY);
  } catch {
    /* nothing to forget, or nowhere it could have been kept */
  }
}

/** The stored body, through the SAME parser as a live one, so a copy from
 *  an older shape of this module is simply not served. */
function storedPrices(): { text: string; prices: TokenPrices } | null {
  const text = readStoredPricesText();
  if (!text) return null;
  try {
    const prices = mapTokenPrices(JSON.parse(text));
    return prices ? { text, prices } : null;
  } catch {
    return null;
  }
}

/** The backend's answer, as text (for the stored copy) and as a read. */
type PricesAnswer =
  | { kind: "failed" }
  | { kind: "answered"; text: string; read: TokenPricesRead };

async function askPrices(token: string): Promise<PricesAnswer> {
  let res: Response;
  try {
    res = await fetch("/api/v2/tokens/prices", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return { kind: "failed" };
  }
  if (!res.ok) return { kind: "failed" };
  let text: string;
  let raw: unknown;
  try {
    text = await res.text();
    raw = JSON.parse(text);
  } catch {
    return { kind: "failed" };
  }
  // The flag-off body arrives as a 200 on purpose (see the BFF note in
  // proxy.ts), so "off" is read off the BODY, never off a status.
  if (!isEnabled(raw)) return { kind: "answered", text, read: { kind: "off" } };
  const prices = mapTokenPrices(raw);
  // Enabled but unparseable is a broken payload, not a switched-off feature.
  return prices
    ? { kind: "answered", text, read: { kind: "ready", prices } }
    : { kind: "failed" };
}

async function readTokenPrices(): Promise<TokenPricesRead> {
  const token = await getAuthToken();
  // Signed out is not a failure and not a flag state: there is no wallet to
  // show and nothing to retry. Guests probe nothing.
  if (!token) return { kind: "off" };
  const answer = await askPrices(token);
  if (answer.kind === "failed") return { kind: "failed" };
  if (answer.read.kind === "ready") rememberPricesText(answer.text);
  else forgetStoredPrices();
  return answer.read;
}

/** Behind a paint from the stored copy: ask once, and only speak up when
 *  the answer differs from what was shown. */
async function revalidateStoredPrices(shownText: string): Promise<void> {
  const token = await getAuthToken();
  // Nobody to show them to; the copy is not wrong, the session is just over.
  if (!token) return;
  const answer = await askPrices(token);
  // Last known beats nothing: a blip must not blank a list already on screen.
  if (answer.kind === "failed") return;
  if (answer.read.kind === "ready") {
    if (answer.text === shownText) return;
    rememberPricesText(answer.text);
  } else {
    forgetStoredPrices();
  }
  const fresh = Promise.resolve(answer.read);
  pricesCache = fresh;
  for (const listener of listeners) listener(answer.read);
}

export function fetchTokenPricesRead(): Promise<TokenPricesRead> {
  if (pricesCache) return pricesCache;
  const stored = storedPrices();
  if (stored) {
    pricesCache = Promise.resolve({ kind: "ready", prices: stored.prices });
    void revalidateStoredPrices(stored.text);
    return pricesCache;
  }
  pricesCache = readTokenPrices();
  return pricesCache;
}

/** Drop the memoised read AND the stored copy. Used by the wallet's retry —
 *  a person asking again wants the backend's answer, not a replay — and by
 *  tests. */
export function resetTokenPricesCache(): void {
  pricesCache = null;
  forgetStoredPrices();
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

/* ------------------------------ per-arc state ----------------------------- */

/** Per-arc charge state for the actions charged ONCE PER ARC (`ref_id` is the
 *  arc id): insights and moment_explanation.
 *
 *  WHY THIS EXISTS. Those charges are idempotent, so the first use costs and
 *  every repeat is free. A static price on such a trigger is right once and
 *  wrong forever after, and a stale price on a control is worse than no price
 *  because people act on it — it would also discourage re-opening something
 *  already paid for. `priceForArcAction` is the only honest way to label them.
 *
 *  NOT FOR `chat`, which has no `ref_id`, is charged every turn, and is
 *  deliberately never surfaced per message. Per-arc and per-turn are different
 *  shapes; do not route chat through here. */
export type ArcCharges =
  | { kind: "off" }
  /** Unreadable, or an older BE without the endpoint. Unknown → no price. */
  | { kind: "unknown" }
  | {
      kind: "ready";
      /** action → has this arc already been charged for it. */
      charged: Record<string, boolean>;
      /** action → price, so pricing a trigger needs no second lookup. */
      prices: Record<string, number>;
    };

export function mapArcCharges(raw: unknown): ArcCharges {
  if (!isEnabled(raw)) return { kind: "off" };

  const charged: Record<string, boolean> = {};
  if (raw.charged && typeof raw.charged === "object") {
    for (const [k, v] of Object.entries(raw.charged as Record<string, unknown>)) {
      if (typeof v === "boolean") charged[k] = v;
    }
  }

  const prices: Record<string, number> = {};
  if (raw.prices && typeof raw.prices === "object") {
    for (const [k, v] of Object.entries(raw.prices as Record<string, unknown>)) {
      const n = num(v);
      if (n !== null) prices[k] = n;
    }
  }

  // Neither half present is not a readable answer — treat it as unknown so no
  // price is shown, rather than as "nothing has been charged yet".
  if (Object.keys(charged).length === 0 && Object.keys(prices).length === 0) {
    return { kind: "unknown" };
  }
  return { kind: "ready", charged, prices };
}

/** The price to SHOW for a per-arc action, or null to show nothing.
 *
 *  Null covers every case where a label would be a guess: pricing off, the arc
 *  unreadable, an action the BE didn't publish, and — the case this function
 *  exists for — an action THIS ARC HAS ALREADY PAID FOR, which is now free. */
export function priceForArcAction(arc: ArcCharges, action: string): number | null {
  if (arc.kind !== "ready") return null;
  // Missing charged flag → unknown for this action → no price. Never assume
  // "not yet charged": that is the assumption that produces a wrong label.
  if (arc.charged[action] !== false) return null;
  const p = arc.prices[action];
  return typeof p === "number" ? p : null;
}

/** Deduped per arc: a thread can show three feedback bubbles for one arc, and
 *  they would otherwise each ask the same question. The lookup never writes, so
 *  sharing an answer is free of side effects.
 *
 *  MUST be cleared when something is charged — a cached `charged:false` outlives
 *  the charge that made it false, and a price that lingers after payment is the
 *  exact stale label this whole endpoint exists to prevent. `resetArcCharges`
 *  is wired to the balance-refresh event for that reason. */
const arcChargesCache = new Map<string, Promise<ArcCharges>>();

export async function fetchArcCharges(arcId: string): Promise<ArcCharges> {
  const hit = arcChargesCache.get(arcId);
  if (hit) return hit;
  const p = getJson(
    `/api/v2/tokens/arc/${encodeURIComponent(arcId)}`,
    mapArcCharges,
    { kind: "unknown" as const }
  );
  arcChargesCache.set(arcId, p);
  return p;
}

/** Drop the memoised per-arc answers (after a spend, and in tests). */
export function resetArcCharges(): void {
  arcChargesCache.clear();
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
