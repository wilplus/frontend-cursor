"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import TokenWalletSheet from "./TokenWalletSheet";
import { TOKENS_COPY, formatShortDate, formatTokens } from "./copy";
import type { TokenWallet } from "@/hooks/useTokenWallet";

/* -------------------------------------------------------------------------- */
/*  TokenBalanceChip — the persistent, low-emphasis wallet read                */
/*                                                                            */
/*  A WALLET, NOT A PROGRESS BAR. It says what you have left to spend and      */
/*  when it comes back. It must never say how much of the month you have       */
/*  "used", never colour-code toward a target, never compare to anyone, and    */
/*  never celebrate spending little. All of those turn a purchase into a       */
/*  performance read, which is the AC-9 fence.                                 */
/*                                                                            */
/*  That is why the LOW state is a quiet muted-foreground change and nothing   */
/*  else: no red, no warning glyph, no modal, no interstitial. Alarm styling   */
/*  on a balance is a score by another route, and a monthly allowance that     */
/*  refills is not an emergency.                                               */
/*                                                                            */
/*  The renewal date rides along with the number and is not dropped for space. */
/*  Without it a falling balance reads as a countdown to being locked out.     */
/* -------------------------------------------------------------------------- */

/** "Low" is under roughly two takes' worth, measured against the most
 *  expensive take band so the warning is never optimistic. Derived from the
 *  served prices, never a hardcoded floor. */
function isLow(balance: number, wallet: TokenWallet): boolean {
  const bands = wallet.prices?.bands ?? [];
  if (bands.length === 0) return false;
  const dearest = bands[bands.length - 1].price;
  return balance < dearest * 2;
}

export default function TokenBalanceChip({
  wallet,
  className,
}: {
  wallet: TokenWallet;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  // Flag off, or not yet confirmed on: NO wallet UI at all. Not a zero, not a
  // skeleton, not a placeholder that resolves into one.
  if (wallet.enabled !== true) return null;

  const ready = wallet.balance.kind === "ready" ? wallet.balance : null;
  // Unknown balance still gets a chip, because the wallet demonstrably exists
  // and the sheet can say the read failed. What it must NOT do is show a zero:
  // that is indistinguishable from being out of tokens.
  const label = ready
    ? TOKENS_COPY.chip(formatTokens(ready.balance), formatShortDate(ready.periodEndsAt))
    : TOKENS_COPY.walletTitle;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={TOKENS_COPY.chipLabel}
        className={cn(
          "rounded-full border border-border px-3 py-1 text-[13px] transition hover:bg-muted",
          ready && isLow(ready.balance, wallet)
            ? "text-muted-foreground"
            : "text-foreground",
          className
        )}
      >
        {label}
      </button>
      {open ? <TokenWalletSheet wallet={wallet} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
