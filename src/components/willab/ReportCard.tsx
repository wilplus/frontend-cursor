"use client";

import type { LoungeMessage } from "@/services/api/loungeMessages";
import { insightView, readoutView } from "./loungeReports";

/* -------------------------------------------------------------------------- */
/*  ReportCard — a persisted Readout / Insight inside the Lounge thread         */
/*                                                                            */
/*  Each is a single clickable bubble (the WHOLE text is the link) that opens   */
/*  its readout / insights. Copy:                                              */
/*    recording_summary → **Your Recording** {topic}, take {N}, {date}          */
/*    insight           → **Your Feedback** Feedback on {topic}, take {N}, {date}│
/*  Text is the same size as a normal chat bubble (text-[15px]).               */
/* -------------------------------------------------------------------------- */

/** The small date line, from the message's FE-stamped timestamp. null when
 *  missing / unparseable. */
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

/** Join the present detail parts: "{topic}, take {N}, {date}" — each omitted
 *  when absent (e.g. standalone recordings have no take; insight topic/take
 *  appear once the BE stamps them on the message). */
function detailLine(
  topic: string | null,
  takeIndex: number | null,
  date: string | null
): string {
  const parts: string[] = [];
  if (topic) parts.push(topic);
  if (takeIndex != null) parts.push(`take ${takeIndex}`);
  if (date) parts.push(date);
  return parts.join(", ");
}

export default function ReportCard({
  message,
  onViewInsights,
}: {
  message: LoungeMessage;
  onViewInsights?: (sessionId: string) => void;
}) {
  const sessionId =
    typeof message.metadata?.session_id === "string"
      ? message.metadata.session_id
      : null;
  const date = reportDateLabel(message.client_created_at);
  const openable = !!(sessionId && onViewInsights);
  const open = () => {
    if (sessionId && onViewInsights) onViewInsights(sessionId);
  };

  if (message.kind === "insight") {
    const v = insightView(message.metadata);
    const detail = detailLine(v.topic, v.takeIndex, date);
    return (
      <div
        role={openable ? "button" : undefined}
        tabIndex={openable ? 0 : undefined}
        onClick={openable ? open : undefined}
        onKeyDown={
          openable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  open();
                }
              }
            : undefined
        }
        className={`my-1 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 ${openable ? "cursor-pointer" : ""}`}
      >
        <p className="text-[15px] leading-relaxed text-foreground">
          <span className="font-semibold">Your Feedback</span>
          {detail ? <span> Feedback on {detail}</span> : null}
        </p>
        {v.overallMessage ? (
          <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">
            {v.overallMessage}
          </p>
        ) : null}
      </div>
    );
  }

  // recording_summary — the durable "Your Recording" card.
  const v = readoutView(message.metadata);
  const detail = detailLine(v.topic, v.takeIndex, date);
  return (
    <div
      role={openable ? "button" : undefined}
      tabIndex={openable ? 0 : undefined}
      onClick={openable ? open : undefined}
      onKeyDown={
        openable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open();
              }
            }
          : undefined
      }
      className={`my-1 rounded-2xl bg-chat-bot px-4 py-3 ${openable ? "cursor-pointer" : ""}`}
    >
      <p className="text-[15px] leading-relaxed text-foreground">
        <span className="font-semibold">Your Recording</span>
        {detail ? <span> {detail}</span> : null}
      </p>
    </div>
  );
}
