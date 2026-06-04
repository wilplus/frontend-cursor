"use client";

import { FileAudio, Sparkles } from "lucide-react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { insightView, readoutView } from "./loungeReports";

/* -------------------------------------------------------------------------- */
/*  ReportCard — a persisted Readout / Insight inside the Lounge thread         */
/*                                                                            */
/*  Renders `recording_summary` and `insight` messages as durable cards so the  */
/*  user can scroll back through every past report. Reads the hero pair (§5)     */
/*  from metadata when present; before seam ③ populates real metrics it shows    */
/*  the title + a "saved to history" line so the entry is still meaningful.     */
/* -------------------------------------------------------------------------- */

export default function ReportCard({
  message,
  onViewInsights,
}: {
  message: LoungeMessage;
  onViewInsights?: (sessionId: string) => void;
}) {
  if (message.kind === "insight") {
    const v = insightView(message.metadata);
    const sessionId =
      typeof message.metadata?.session_id === "string"
        ? message.metadata.session_id
        : null;
    return (
      <div className="my-1 rounded-2xl border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-semibold text-foreground">
            Coach insights
          </span>
        </div>
        {v.overallMessage ? (
          <p className="mt-1.5 text-[15px] text-foreground">{v.overallMessage}</p>
        ) : (
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {v.noteCount != null
              ? `${v.noteCount} note${v.noteCount === 1 ? "" : "s"} from your coach.`
              : message.body}
          </p>
        )}
        {sessionId && onViewInsights ? (
          <button
            type="button"
            onClick={() => onViewInsights(sessionId)}
            className="mt-2 text-[13px] font-medium text-primary underline-offset-2 hover:underline"
          >
            View insights →
          </button>
        ) : null}
      </div>
    );
  }

  const v = readoutView(message.metadata);
  const hasMetrics = v.speechRate != null || v.pauseRatio != null;
  return (
    <div className="my-1 rounded-2xl border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <FileAudio className="h-4 w-4 text-muted-foreground" />
        <span className="text-[13px] font-semibold text-foreground">
          Readout{v.topic ? ` · ${v.topic}` : ""}
        </span>
      </div>
      {hasMetrics ? (
        <div className="mt-2 flex gap-6">
          {v.speechRate != null && (
            <Metric label="Speech rate" value={`${Math.round(v.speechRate)} wpm`} />
          )}
          {v.pauseRatio != null && (
            <Metric label="Pause ratio" value={`${Math.round(v.pauseRatio * 100)}%`} />
          )}
        </div>
      ) : (
        <p className="mt-1 text-[12px] text-muted-foreground">
          Saved to your history — the full breakdown opens once analysis lands.
        </p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[17px] font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
