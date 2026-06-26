"use client";

import { Crown, Mic } from "lucide-react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { bestPresentationView, insightView, readoutView } from "./loungeReports";

/* -------------------------------------------------------------------------- */
/*  ReportCard — persisted Readout / Insight / Ideal-Text cards (C2 taxonomy)   */
/*                                                                            */
/*  Strict 3-tier system (rule: orange = USER only; system/coach = grey,        */
/*  EXCEPT the ideal-text hero):                                               */
/*    recording_summary  → USER: short ORANGE voice-message bubble, right-      │
/*                         aligned. "Your Recording {name}, take {n}, {date}".  */
/*    insight            → COACH: GREY full-width. "Feedback on {name}, …".     */
/*    best_presentation_ready → the HERO: full-width indigo/violet card, gold   │
/*                         crown, "Ideal Text for {name} is ready!", with both  */
/*                         CTAs (best presentation / breakthroughs) merged in.  */
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

/** Join the present detail parts: "{name}, take {N}, {date}" — each omitted when
 *  absent (name = the BE topic; take_index from metadata; date = timestamp). */
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
  onOpenBestPresentation,
  onOpenBreakthroughs,
}: {
  message: LoungeMessage;
  onViewInsights?: (sessionId: string) => void;
  onOpenBestPresentation?: (arcId: string) => void;
  onOpenBreakthroughs?: (arcId: string) => void;
}) {
  // C2 — the HERO: "Ideal Text for {name} is ready!" (BE-inserted at the 3rd
  // take). The single ready card; both CTAs live here.
  if (message.kind === "best_presentation_ready") {
    const v = bestPresentationView(message.metadata);
    return (
      <IdealTextHeroCard
        name={v.topic}
        arcId={v.arcId}
        onOpenBestPresentation={onOpenBestPresentation}
        onOpenBreakthroughs={onOpenBreakthroughs}
      />
    );
  }

  const sessionId =
    typeof message.metadata?.session_id === "string"
      ? message.metadata.session_id
      : null;
  const date = reportDateLabel(message.client_created_at);
  const openable = !!(sessionId && onViewInsights);
  const open = () => {
    if (sessionId && onViewInsights) onViewInsights(sessionId);
  };
  const openKeyDown = openable
    ? (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }
    : undefined;

  if (message.kind === "insight") {
    // COACH feedback — GREY, full width.
    const v = insightView(message.metadata);
    const detail = detailLine(v.topic, v.takeIndex, date);
    return (
      <div
        role={openable ? "button" : undefined}
        tabIndex={openable ? 0 : undefined}
        onClick={openable ? open : undefined}
        onKeyDown={openKeyDown}
        className={`my-1 rounded-2xl bg-chat-bot px-4 py-3 ${openable ? "cursor-pointer" : ""}`}
      >
        <p className="text-[15px] leading-relaxed text-foreground">
          <span className="font-semibold">Feedback</span>
          {detail ? <span> on {detail}</span> : null}
        </p>
        {v.overallMessage ? (
          <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">
            {v.overallMessage}
          </p>
        ) : null}
      </div>
    );
  }

  // recording_summary — USER: short ORANGE voice-message bubble, right-aligned.
  const v = readoutView(message.metadata);
  const detail = detailLine(v.topic, v.takeIndex, date);
  return (
    <div
      role={openable ? "button" : undefined}
      tabIndex={openable ? 0 : undefined}
      onClick={openable ? open : undefined}
      onKeyDown={openKeyDown}
      className={`my-1 ml-auto flex max-w-[80%] items-center gap-2 rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-primary-foreground ${openable ? "cursor-pointer" : ""}`}
    >
      <Mic className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
      <p className="text-[15px] leading-snug">
        <span className="font-semibold">Your Recording</span>
        {detail ? <span> {detail}</span> : null}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  IdealTextHeroCard — the hero treatment, reused wherever the best            */
/*  presentation / ideal text is referenced (chat card here; overlay header     */
/*  echoes the crown + colour). Deep indigo/violet with a gold crown.           */
/* -------------------------------------------------------------------------- */

export function IdealTextHeroCard({
  name,
  arcId,
  onOpenBestPresentation,
  onOpenBreakthroughs,
}: {
  name: string | null;
  arcId: string | null;
  onOpenBestPresentation?: (arcId: string) => void;
  onOpenBreakthroughs?: (arcId: string) => void;
}) {
  const canBest = !!(arcId && onOpenBestPresentation);
  const canBreak = !!(arcId && onOpenBreakthroughs);
  return (
    <div className="my-1 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 px-4 py-4 text-white shadow-sm">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
        <p className="text-[16px] font-semibold leading-snug">
          Ideal Text{name ? <span> for {name}</span> : null} is ready!
        </p>
      </div>
      {canBest || canBreak ? (
        <div className="mt-3 flex flex-col gap-2">
          {canBest ? (
            <button
              type="button"
              onClick={() => onOpenBestPresentation!(arcId!)}
              className="w-full rounded-full bg-white px-4 py-2 text-[14px] font-medium text-indigo-700 transition-colors hover:bg-white/90"
            >
              View your best presentation
            </button>
          ) : null}
          {canBreak ? (
            <button
              type="button"
              onClick={() => onOpenBreakthroughs!(arcId!)}
              className="w-full rounded-full border border-white/40 px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-white/10"
            >
              View your breakthrough moments
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
