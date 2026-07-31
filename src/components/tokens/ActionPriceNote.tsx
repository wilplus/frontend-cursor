"use client";

import { TOKENS_COPY, formatTokens } from "./copy";
import { useActionPrice } from "./useActionPrice";

/* -------------------------------------------------------------------------- */
/*  ActionPriceNote — the published price of one action, on its control        */
/*                                                                            */
/*  Renders nothing when pricing is off or the BE published no price for this  */
/*  action, so it is safe to drop next to any trigger. Like every price        */
/*  surface here it is inert: text only, no gate, no disabled state.           */
/*                                                                            */
/*  Not for chat. See useActionPrice for why a per-message price is the one    */
/*  place surfacing the number makes the product worse.                        */
/* -------------------------------------------------------------------------- */

export default function ActionPriceNote({
  action,
  className,
}: {
  action: string;
  className?: string;
}) {
  const price = useActionPrice(action);
  if (price === null) return null;
  return (
    <p className={className ?? "text-[12px] text-muted-foreground"}>
      {TOKENS_COPY.actionPrice(formatTokens(price))}
    </p>
  );
}
