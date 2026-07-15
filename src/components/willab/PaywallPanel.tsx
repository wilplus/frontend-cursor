"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { homeworkApi } from "@/lib/api/homework-client";
import { unlockArc, ARC_UNLOCK_CREDITS } from "@/services/api/arcUnlock";

/* -------------------------------------------------------------------------- */
/*  PaywallPanel — the per-bubble $25/25-credit unlock (delivery layer)        */
/*                                                                            */
/*  One arc unlock opens feedback #2, #3 AND the ideal text together.         */
/*  Rendered inside a gated overlay body (the host owns the top-right X).      */
/*  Copy: cost + the user's current balance (fetched from the same source the  */
/*  header uses; guests / fetch-fail → the balance line simply drops).          */
/*  Buy → POST /v2/arc/<id>/unlock: ok → onUnlocked (host refetches);           */
/*  insufficient credits → route to the pricing page to top up.                */
/* -------------------------------------------------------------------------- */

export default function PaywallPanel({
  arcId,
  onUnlocked,
}: {
  arcId: string;
  onUnlocked: () => void;
}) {
  const [credits, setCredits] = useState<number | null>(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Best-effort balance for the "you have N" line (same source as the header).
  useEffect(() => {
    let active = true;
    void homeworkApi
      .getStatus()
      .then((s: { credits?: number | null } | null) => {
        if (active && typeof s?.credits === "number") setCredits(s.credits);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function buy() {
    if (buying) return;
    setBuying(true);
    setError(null);
    const res = await unlockArc(arcId);
    setBuying(false);
    if (res.ok) {
      onUnlocked();
      return;
    }
    if (res.reason === "insufficient") {
      // Not enough credits — the pricing page is where top-ups live. A HARD
      // navigation, deliberately: this panel can sit inside overlays stacked
      // over LibraryOverlay, whose back-dismiss unmount cleanup would pop a
      // router.push right back off the stack (the documented forward-nav trap).
      window.location.assign("/dashboard/pricing");
      return;
    }
    setError(res.message);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
      </span>
      <p className="max-w-sm text-[16px] leading-relaxed text-foreground">
        This costs {ARC_UNLOCK_CREDITS} credits
        {credits !== null ? `, you have ${credits}` : ""}. Buy your ideal text
        and behavioural analysis?
      </p>
      <p className="max-w-sm text-[13px] text-muted-foreground">
        One unlock opens all three takes&apos; feedback and your ideal text.
      </p>
      <Button
        type="button"
        onClick={() => void buy()}
        disabled={buying}
        className="h-11 rounded-full bg-foreground px-7 text-[15px] font-medium text-background hover:bg-foreground/90"
      >
        {buying ? "Unlocking…" : `Buy for ${ARC_UNLOCK_CREDITS} credits`}
      </Button>
      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
    </div>
  );
}
