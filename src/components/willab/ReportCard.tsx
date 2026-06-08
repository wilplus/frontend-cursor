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
        {/* B8 — drop the redundant "Your coach's insights are ready."
            fallback line; the icon + header + "View insights →" already say
            that. Keep the coach's actual overall message when present (the
            warm human line worth showing); show nothing extra when absent. */}
        {v.overallMessage ? (
          <p className="mt-1.5 text-[15px] text-foreground">{v.overallMessage}</p>
        ) : null}
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

  // B7 — a "completed training" marker in the thread: an ordinary bubble,
  // NOT a metrics card. The acoustic breakdown lives in the Readout / History
  // surface; the thread entry just confirms the session happened (bolded,
  // icon kept, no special metric styling).
  const v = readoutView(message.metadata);
  return (
    <div className="my-1 flex items-center gap-2 rounded-2xl bg-chat-bot px-4 py-2.5">
      <FileAudio className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-[15px] font-semibold text-foreground">
        Completed training{v.topic ? ` · ${v.topic}` : ""}
      </span>
    </div>
  );
}
