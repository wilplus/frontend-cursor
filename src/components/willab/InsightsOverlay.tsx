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
  onClose: () => void;
}) {
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
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="text-[13px] font-semibold text-foreground">
          {data &&
          (data.readout.overallMessage != null ||
            data.readout.snippets.some((s) => s.coach != null))
            ? "Coach insights"
            : "Your readout"}
        </span>
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
              We couldn&apos;t load these insights just now — try again in a
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
          <ReadoutCard payload={data.readout} variant="insights" />
        )}
      </div>
    </div>
  );
}
