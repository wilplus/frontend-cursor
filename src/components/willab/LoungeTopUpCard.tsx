"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import TokenPlanChips from "@/components/tokens/TokenPlanChips";
import { TOKENS_COPY, formatShortDate } from "@/components/tokens/copy";
import { planControlsFor } from "@/components/tokens/planControls";
import { useTokenWallet } from "@/hooks/useTokenWallet";
import { startPlanCheckout } from "@/services/api/subscribe";
import { fetchRecordingBand, type RecordingBandState } from "@/services/api/tokens";
import { canMountTopUpCard } from "./topUpCardGate";
import { type WillabState } from "./useWillabFlow";

/* -------------------------------------------------------------------------- */
/*  LoungeTopUpCard — the out-of-tokens offer, INSIDE the conversation        */
/*                                                                            */
/*  WHY IT EXISTS. Until now the only surface in the whole app that mentioned */
/*  running dry was one non-clickable sentence under the record button, and   */
/*  the strings written for the blocked case were referenced zero times. A    */
/*  user who ran out had no route to pay from where they were.                */
/*                                                                            */
/*  IN-THREAD, NEVER AN OVERLAY. No modal, dialog, sheet, portal or z-index   */
/*  layer. It renders as an ordinary item in the thread's scroll container,   */
/*  exactly like LoungeSpeakerSexPrompt — it scrolls with the conversation,   */
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

export default function LoungeTopUpCard({
  state,
  threadLoading = false,
}: LoungeTopUpCardProps) {
  const wallet = useTokenWallet(true);
  const [band, setBand] = useState<RecordingBandState>({ kind: "unknown" });
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Starts as "snoozed for everything" so the card cannot flash before
  // localStorage has been read.
  const [snoozedPeriod, setSnoozedPeriod] = useState<string | null>(null);
  const [storageRead, setStorageRead] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setSnoozedPeriod(window.localStorage.getItem(SNOOZE_KEY));
    } catch {
      // Private mode / storage disabled: fall through to SHOWING the card.
      // Being offered again is a smaller cost than never being offered.
      setSnoozedPeriod(null);
    }
    setStorageRead(true);
  }, []);

  /* The SAME "out of tokens" signal RecordPriceNote already consumes. There
   * is deliberately no second definition of running dry, and no new endpoint:
   * every signal this card needs already exists. */
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

  if (!canMountTopUpCard(state, threadLoading)) return null;
  if (dismissed || !storageRead) return null;
  if (wallet.enabled !== true) return null;
  if (band.kind !== "exhausted") return null;

  const ready = wallet.balance.kind === "ready" ? wallet.balance : null;
  // Never offer checkout to someone who already has a live subscription: a
  // second Checkout Session creates a SECOND subscription and charges them
  // twice. Switching plans goes through the billing portal on the wallet page.
  const controls = planControlsFor(ready?.plan ?? null, ready?.tier ?? null);
  if (!controls.canBuy) return null;

  const tiers = wallet.prices?.tiers ?? {};
  const hasPaidTier = Object.values(tiers).some((t) => t.usdPerMonth > 0);
  if (!hasPaidTier) return null;

  const periodEndsAt = band.periodEndsAt ?? ready?.periodEndsAt ?? null;
  if (periodEndsAt && snoozedPeriod === periodEndsAt) return null;

  const choose = async (tier: string) => {
    if (busyTier) return;
    setBusyTier(tier);
    setError(null);
    const r = await startPlanCheckout(tier);
    if (r.ok) {
      window.location.assign(r.url);
      return;
    }
    setBusyTier(null);
    // A server that cannot sell should stop offering: hide the card entirely
    // rather than leave chips that will each fail the same way.
    if (r.reason === "unavailable") {
      setDismissed(true);
      return;
    }
    setError(r.reason === "error" ? TOKENS_COPY.topUpFailed : r.message);
  };

  const dismiss = () => {
    try {
      // No period date (an unreadable balance) still dismisses for this
      // session; it simply cannot be remembered across a reload.
      if (periodEndsAt) window.localStorage.setItem(SNOOZE_KEY, periodEndsAt);
    } catch {
      /* non-fatal: worst case we offer again next visit */
    }
    setDismissed(true);
  };

  const renewsOn = formatShortDate(periodEndsAt);

  return (
    <div className="mt-1 w-full rounded-xl border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium">{TOKENS_COPY.topUpTitle}</p>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-muted-foreground">
        {renewsOn ? TOKENS_COPY.topUpRenews(renewsOn) : TOKENS_COPY.topUpNoDate}
      </p>

      <TokenPlanChips
        tiers={tiers}
        busyTier={busyTier}
        onChoose={(t) => void choose(t)}
      />

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={dismiss}
          disabled={busyTier !== null}
          className="text-muted-foreground"
        >
          {TOKENS_COPY.topUpDismiss}
        </Button>
      </div>
    </div>
  );
}
