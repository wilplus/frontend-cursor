"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TokenPlanChips from "@/components/tokens/TokenPlanChips";
import { TOKENS_COPY } from "@/components/tokens/copy";
import { useTokenWallet } from "@/hooks/useTokenWallet";
import { startPlanCheckout } from "@/services/api/subscribe";
import { fetchRecordingBand, type RecordingBandState } from "@/services/api/tokens";
import { canMountTopUpCard } from "./topUpCardGate";
import { type WillabState } from "./useWillabFlow";
import SymmetricPair from "./SymmetricPair";

/* -------------------------------------------------------------------------- */
/*  LoungeTopUpCard — the out-of-tokens offer, INSIDE the conversation        */
/*                                                                            */
/*  WHY IT EXISTS. Until now the only surface in the whole app that mentioned */
/*  running dry was one non-clickable sentence under the record button, and   */
/*  the strings written for the blocked case were referenced zero times. A    */
/*  user who ran out had no route to pay from where they were.                */
/*                                                                            */
/*  THE ASK PATTERN (founder 2026-10-15, "approved, build the unified        */
/*  version", https://claude.ai/artifact/CzVL6JWK85tZDVpU9JRtgY): Will's     */
/*  message in the thread (tap to reopen), the plans in the grey card in the  */
/*  footer, then Not now | See prices, as the WhatsApp ask.                   */
/*                                                                            */
/*  IN-THREAD, NEVER AN OVERLAY. No modal, dialog, sheet, portal or z-index   */
/*  layer. It renders as an ordinary item in the thread's scroll container,   */
/*  as an in-thread card — it scrolls with the conversation,                  */
/*  cannot cover anything, and steals no focus. This is the LIVE LOOP fence,  */
/*  not a style preference: a card that can appear over a running             */
/*  record→transcribe→coach loop is what that fence forbids.                  */
/*                                                                            */
/*  IT NEVER GATES ANYTHING. Recording stays enabled at zero balance, always. */
/*  Charges are soft server-side and floor at zero, so a take started with an */
/*  empty wallet still produces a transcript. This is an OFFER, and the wait  */
/*  route (tokens renew monthly) is kept beside the buy route on purpose.     */
/*                                                                            */
/*  EVERYTHING FAILS CLOSED. Any read that does not come back cleanly renders */
/*  no card at all, never a broken one.                                       */
/* -------------------------------------------------------------------------- */

/** Local-only, and keyed to the BILLING PERIOD rather than a boolean.
 *
 *  Running dry recurs every month, so a permanent flag would silence the card
 *  forever after one dismissal. Storing `period_ends_at` means the card comes
 *  back once a new period has rolled and the user has run out again. */
const SNOOZE_KEY = "willab.topUp.snoozedPeriod";

export interface LoungeTopUpCardProps {
  /** The flow state, so we stay out of the Lab's way. */
  state: WillabState;
  /** True while the thread is still fetching — no card above a skeleton. */
  threadLoading?: boolean;
}

export interface TopUpOffer {
  /** Out of tokens, with plans to offer: Will's message shows. */
  visible: boolean;
  /** The footer holds the plans and the pair. */
  armed: boolean;
  rearm: () => void;
  notNow: () => void;
  choose: (tier: string) => void;
  tiers: Parameters<typeof TokenPlanChips>[0]["tiers"];
  busyTier: string | null;
  error: string | null;
}

/** The out-of-tokens ask's state, read once by the Lounge for its two
 *  halves: the bubble in the thread and the footer. */
export function useTopUpOffer({
  state,
  threadLoading = false,
}: LoungeTopUpCardProps): TopUpOffer {
  const wallet = useTokenWallet(true);
  const [band, setBand] = useState<RecordingBandState>({ kind: "unknown" });
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Starts as "snoozed for everything" so the ask cannot flash before
  // localStorage has been read.
  const [snoozedPeriod, setSnoozedPeriod] = useState<string | null>(null);
  const [storageRead, setStorageRead] = useState(false);
  const [gone, setGone] = useState(false);
  const [armed, setArmed] = useState(true);

  useEffect(() => {
    try {
      setSnoozedPeriod(window.localStorage.getItem(SNOOZE_KEY));
    } catch {
      // Private mode / storage disabled: fall through to SHOWING the ask.
      // Being offered again is a smaller cost than never being offered.
      setSnoozedPeriod(null);
    }
    setStorageRead(true);
  }, []);

  /* The SAME "out of tokens" signal RecordPriceNote already consumes. There
   * is deliberately no second definition of running dry, and no new endpoint:
   * every signal this ask needs already exists. */
  useEffect(() => {
    if (wallet.enabled !== true) return;
    let cancelled = false;
    void fetchRecordingBand().then((b) => {
      if (!cancelled) setBand(b);
    });
    return () => {
      cancelled = true;
    };
  }, [wallet.enabled]);

  const ready = wallet.balance.kind === "ready" ? wallet.balance : null;
  const tiers = wallet.prices?.tiers ?? {};
  const hasPaidTier = Object.values(tiers).some((t) => t.usdPerMonth > 0);
  const periodEndsAt =
    (band.kind === "exhausted" ? band.periodEndsAt : null) ?? ready?.periodEndsAt ?? null;
  // Every purchase is a one-time package (N48.3 Q13 A): there is no live
  // subscription a second checkout could stack on, so the ask always offers.
  const visible =
    canMountTopUpCard(state, threadLoading) &&
    !gone && storageRead && wallet.enabled === true &&
    band.kind === "exhausted" && hasPaidTier &&
    !(periodEndsAt && snoozedPeriod === periodEndsAt);

  const choose = (tier: string) => {
    if (busyTier) return;
    setBusyTier(tier);
    setError(null);
    void startPlanCheckout(tier).then((r) => {
      if (r.ok) {
        window.location.assign(r.url);
        return;
      }
      setBusyTier(null);
      if (r.reason === "unavailable") {
        setGone(true);
        return;
      }
      setError(TOKENS_COPY.topUpFailed);
    });
  };

  // Not now: the footer gives the record button back and the period is
  // snoozed; Will's message stays in this session and reopens the ask.
  const notNow = () => {
    try {
      if (periodEndsAt) window.localStorage.setItem(SNOOZE_KEY, periodEndsAt);
    } catch {
      /* storage blocked: the ask may come back next time, which is fine */
    }
    setArmed(false);
  };

  return {
    visible,
    armed: visible && armed,
    rearm: () => setArmed(true),
    notNow,
    choose,
    tiers,
    busyTier,
    error,
  };
}

/** Will's message in the thread: the two lines the card used to carry. */
export function TopUpBubble({ offer }: { offer: TopUpOffer }) {
  if (!offer.visible) return null;
  return (
    <button
      type="button"
      onClick={offer.rearm}
      aria-expanded={offer.armed}
      aria-label="Reopen this option"
      className="mr-auto block max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-left text-[15px] leading-relaxed text-foreground transition-colors hover:bg-muted/80"
    >
      {TOKENS_COPY.topUpTitle} {TOKENS_COPY.topUpNoDate}
    </button>
  );
}

/** The footer while the ask is open: the plans in the grey card, then
 *  Not now | See prices, in place of the record row. */
export function TopUpSlot({
  offer,
  children,
}: {
  offer: TopUpOffer;
  children: React.ReactNode;
}) {
  const router = useRouter();
  if (!offer.armed) return <>{children}</>;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-muted p-3">
        <TokenPlanChips
          tiers={offer.tiers}
          busyTier={offer.busyTier}
          onChoose={offer.choose}
        />
        {offer.error ? (
          <p role="alert" className="mt-2 text-[13px] text-destructive">{offer.error}</p>
        ) : null}
      </div>
      <SymmetricPair
        closeLabel={TOKENS_COPY.topUpDismiss}
        onClose={offer.notNow}
        actionLabel={TOKENS_COPY.topUpSeePrices}
        onAction={() => router.push("/dashboard/pricing")}
      />
    </div>
  );
}
