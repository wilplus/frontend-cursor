"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TokenTier } from "@/services/api/tokens";
import { TOKENS_COPY, formatTokens } from "./copy";

/* -------------------------------------------------------------------------- */
/*  TokenPlanChips — the paid plans as one tappable row                       */
/*                                                                            */
/*  The chip row from SpeakerSexQuestion.tsx (the pattern the founder named:   */
/*  "like with sex to choose"), with one difference that matters: these are    */
/*  BUTTONS, not radios. A radio selects and waits for a submit; here one tap  */
/*  IS the action, and it goes straight to Stripe.                            */
/*                                                                            */
/*  ORDER COMES FROM PRICE, NEVER FROM A LIST OF NAMES. Cheapest first, off    */
/*  `usdPerMonth`. A hardcoded ladder is the exact defect that made the        */
/*  pricing page render zero cards the day a tier got renamed, and             */
/*  tierKeyFence.test.ts fails the build if a tier key appears in this file.   */
/*                                                                            */
/*  PALETTE: monochrome, with AT MOST ONE orange element (TokenPlanCards.tsx   */
/*  :30-35 is the standing rule). It rides the middle chip — emphasis by       */
/*  design rather than a claim about other users, which is also why there is   */
/*  no "most popular" badge and no savings percentage (dropped with v3: the    */
/*  ladder reprices on coach reviews, so per-token the upper tiers cost MORE   */
/*  and any savings label would be lying).                                    */
/* -------------------------------------------------------------------------- */

export default function TokenPlanChips({
  tiers,
  busyTier,
  disabled,
  onChoose,
}: {
  /** The served tier list. Free is filtered out here — you do not check out
   *  to pay nothing. */
  tiers: Record<string, TokenTier>;
  /** The chip currently opening Stripe, if any. */
  busyTier: string | null;
  disabled?: boolean;
  onChoose: (tier: string) => void;
}) {
  const paid = Object.keys(tiers)
    .filter((name) => tiers[name].usdPerMonth > 0)
    .sort((a, b) => tiers[a].usdPerMonth - tiers[b].usdPerMonth);

  if (paid.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
      {paid.map((name, i) => {
        const tier = tiers[name];
        // The single orange element, on the middle chip when there are three.
        const accent = paid.length === 3 && i === 1;
        const busy = busyTier === name;
        return (
          <button
            key={name}
            type="button"
            disabled={disabled || busyTier !== null}
            onClick={() => onChoose(name)}
            className={cn(
              "flex flex-1 cursor-pointer flex-col items-start gap-0.5 rounded-lg",
              "border px-3 py-2 text-left text-sm transition-colors",
              accent
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/40",
              (disabled || busyTier !== null) && "cursor-not-allowed opacity-60"
            )}
          >
            <span className="font-medium capitalize">
              {TOKENS_COPY.topUpChip(name, formatTokens(tier.tokensPerMonth))}
            </span>
            <span className="flex items-center text-xs text-muted-foreground">
              {busy ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden />
                  {TOKENS_COPY.walletChoosePlanBusy}
                </>
              ) : (
                TOKENS_COPY.topUpChipPrice(tier.usdPerMonth)
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
