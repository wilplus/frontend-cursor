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

/** A-3 — the completed-training card's small date line, from the message's
 *  FE-stamped timestamp. Returns null for a missing / unparseable stamp. */
function reportDateLabel(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

  // A-3 (wave-3) — the completed-training card: the durable in-thread record
  // that this session was finished and handed to the coach. Bold topic · small
  // date · a soft (not hard-ETA) coach line. The acoustic breakdown lives in
  // the Readout / History surface; this is the conversational confirmation.
  const v = readoutView(message.metadata);
  const date = reportDateLabel(message.client_created_at);
  const sessionId =
    typeof message.metadata?.session_id === "string"
      ? message.metadata.session_id
      : null;
  const openable = !!(sessionId && onViewInsights);
  return (
    <div
      role={openable ? "button" : undefined}
      tabIndex={openable ? 0 : undefined}
      onClick={openable ? () => onViewInsights!(sessionId!) : undefined}
      onKeyDown={
        openable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onViewInsights!(sessionId!);
              }
            }
          : undefined
      }
      className={`my-1 rounded-2xl bg-chat-bot px-4 py-3 ${openable ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center gap-2">
        <FileAudio
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="text-[15px] font-semibold text-foreground">
          {v.topic || "Training"}
        </span>
      </div>
      {date ? (
        <p className="mt-0.5 text-[12px] text-muted-foreground">{date}</p>
      ) : null}
      <p className="mt-1.5 text-[14px] leading-relaxed text-foreground">
        Training completed and sent to coach, who will email you when the
        analysis is ready.
      </p>
      {openable ? (
        <p className="mt-2 text-[13px] font-medium text-primary">
          View this recording →
        </p>
      ) : null}
    </div>
  );
}
