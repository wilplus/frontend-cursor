"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchSessionReadout,
  type SessionReadout,
} from "@/services/api/sessionReadout";
import ReadoutCard from "./ReadoutCard";
import AuditInsights from "./AuditInsights";
import { useBackDismiss } from "./useBackDismiss";

/* -------------------------------------------------------------------------- */
/*  InsightsOverlay — the coach's read on a sent recording (§6)               */
/*                                                                            */
/*  Opened from an `insight` card in the Lounge. Re-reads the session (which    */
/*  also triggers the BE's library ingest, §3.11) and renders the Readout in    */
/*  "insights" variant: the coach's overall message + per-snippet notes layered │
/*  on the same acoustic data (the §5 raw → §6 human-read two-stage story).     */
/* -------------------------------------------------------------------------- */

export default function InsightsOverlay({
  sessionId,
  onClose,
}: {
  sessionId: string;
  /** Closing returns to the Lounge thread underneath. (Wave-3 B-1 dropped the
   *  post-feedback offer this overlay used to feed a `to_work_on` count for;
   *  the proactive strong-sides offer now lives at the post-send moment,
   *  A-4 / B-2, so close carries no payload.) */
  onClose: () => void;
}) {
  // D-3 — back-gesture / Back dismisses this overlay instead of routing away.
  useBackDismiss(onClose);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<SessionReadout | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    void fetchSessionReadout(sessionId).then((r) => {
      if (!active) return;
      if (r) {
        setData(r);
        setStatus("ready");
      } else {
        setStatus("error");
      }
    });
    return () => {
      active = false;
    };
  }, [sessionId]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      {/* Unified X-only header — no title (matches the Lab overlay); each page's
          own heading ("Avoid" / "Do more" / "From your coach") carries context. */}
      <div className="flex h-12 shrink-0 items-center justify-end px-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close insights"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 py-6">
        {status === "loading" ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : status === "error" || !data ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-sm text-[15px] text-muted-foreground">
              We couldn&apos;t load these insights just now. Try again in a
              moment.
            </p>
            <Button onClick={onClose} variant="outline" className="rounded-full px-6">
              Back to Lounge
            </Button>
          </div>
        ) : data.readout.snippets.some((s) => s.coach?.tag != null) ? (
          // Post-publish, coach-curated → the paged Voice Audit (Double down / Avoid).
          <AuditInsights payload={data.readout} />
        ) : (
          // Pre-publish / untagged → the neutral raw §5 Readout.
          <ReadoutCard payload={data.readout} />
        )}
      </div>
    </div>
  );
}
