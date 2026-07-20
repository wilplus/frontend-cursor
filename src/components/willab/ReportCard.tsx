"use client";

import { useEffect, useState } from "react";
import { Crown, Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchIdealText } from "@/services/api/idealText";
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

/** Delivery layer — the feedback bubble's parsed metadata. */
export interface FeedbackBubbleTarget {
  arcId: string;
  takeSessionId: string | null;
  takeIndex: number | null;
}

export default function ReportCard({
  message,
  onViewInsights,
  onOpenBestPresentation,
  onOpenBreakthroughs,
  onOpenTranscripts,
  onOpenFeedback,
  onOpenIdealText,
  heroIdealText = false,
}: {
  message: LoungeMessage;
  onViewInsights?: (sessionId: string) => void;
  onOpenBestPresentation?: (arcId: string) => void;
  onOpenBreakthroughs?: (arcId: string) => void;
  /** transcript_ready — opens the Trainings library (where transcripts live). */
  onOpenTranscripts?: () => void;
  /** Delivery layer — a grey feedback bubble opens its take's feedback page. */
  onOpenFeedback?: (target: FeedbackBubbleTarget) => void;
  /** Delivery layer — the purple bubble opens the ideal-text notebook. */
  onOpenIdealText?: (arcId: string) => void;
  /** FE-C — true on the LATEST ideal_text bubble (highest version): it renders
   *  as the large crucial card; older ones stay compact version history. */
  heroIdealText?: boolean;
}) {
  // Delivery layer — grey feedback card, one per take (1 free, 2/3 paywalled
  // behind the tap: the feedback page itself renders the unlock panel).
  if (message.kind === "feedback") {
    const arcId =
      typeof message.metadata?.arc_id === "string" ? message.metadata.arc_id : null;
    const takeSessionId =
      typeof message.metadata?.take_session_id === "string"
        ? message.metadata.take_session_id
        : null;
    const takeIndex =
      typeof message.metadata?.take_index === "number"
        ? message.metadata.take_index
        : null;
    const openable = !!(arcId && onOpenFeedback);
    const open = () => {
      if (arcId && onOpenFeedback)
        onOpenFeedback({ arcId, takeSessionId, takeIndex });
    };
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
          <span className="font-semibold">
            Feedback{takeIndex != null ? ` · Take ${takeIndex}` : ""}
          </span>
        </p>
        {message.body ? (
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
            {message.body}
          </p>
        ) : null}
      </div>
    );
  }

  // Delivery layer — the ideal-text cards. Two variants share the kind:
  //   metadata.variant "instant" → the FREE machine draft at take 3: a plain
  //     grey card (deliberately NOT purple, so the later coach-perfected purple
  //     bubble still reads as the upgrade moment, never a duplicate).
  //   no variant / "perfected" → the publish-time PURPLE card (unchanged).
  if (message.kind === "ideal_text") {
    const arcId =
      typeof message.metadata?.arc_id === "string" ? message.metadata.arc_id : null;
    const openable = !!(arcId && onOpenIdealText);
    const open = () => {
      if (arcId && onOpenIdealText) onOpenIdealText(arcId);
    };
    // FE-C — the crucial bubble: the latest version renders as a large, tall
    // card with the live GET's title/status/version/date and one Open button.
    if (heroIdealText && arcId && onOpenIdealText) {
      return (
        <CrucialIdealTextCard arcId={arcId} onOpen={() => onOpenIdealText(arcId)} />
      );
    }
    // FE-3 — the thread is the HISTORY OF VERSIONS: every assembled version
    // posts its own card, 1.0 unverified through N.0 verified. The version and
    // the verification state both ride on the BE metadata.
    const rawV = message.metadata?.version;
    const version =
      typeof rawV === "number" && Number.isFinite(rawV)
        ? rawV
        : typeof rawV === "string" && rawV.trim() && Number.isFinite(Number(rawV))
          ? Number(rawV)
          : null;
    const verified = message.metadata?.variant === "verified";
    const versionLabel = version === null ? null : `Ideal text ${version}.0`;
    if (message.metadata?.variant === "instant") {
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
          className={`my-1 rounded-2xl border border-primary/30 bg-chat-bot px-4 py-3 ${
            openable ? "cursor-pointer" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p className="text-[15px] font-semibold leading-snug text-foreground">
              Instant ideal text
            </p>
          </div>
          {message.body ? (
            <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
              {message.body}
            </p>
          ) : null}
        </div>
      );
    }
    const keyDown = openable
      ? (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }
      : undefined;
    // A version that is NOT yet verified reads as a plain card, so the purple
    // still marks the moment the coach signs it off rather than repeating.
    if (versionLabel && !verified) {
      return (
        <div
          role={openable ? "button" : undefined}
          tabIndex={openable ? 0 : undefined}
          onClick={openable ? open : undefined}
          onKeyDown={keyDown}
          className={`my-1 rounded-2xl border border-border bg-chat-bot px-4 py-3 ${
            openable ? "cursor-pointer" : ""
          }`}
        >
          <p className="text-[15px] font-semibold leading-snug text-foreground">
            {versionLabel}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Pending verification by your coach
          </p>
        </div>
      );
    }
    return (
      <div
        role={openable ? "button" : undefined}
        tabIndex={openable ? 0 : undefined}
        onClick={openable ? open : undefined}
        onKeyDown={keyDown}
        className={`my-1 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 px-4 py-3.5 text-white shadow-sm ${
          openable ? "cursor-pointer" : ""
        }`}
      >
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
          <p className="text-[15px] font-semibold leading-snug">
            {versionLabel ?? "Your ideal text"}
          </p>
        </div>
        <p className="mt-1 text-[14px] leading-relaxed text-white/85">
          {verified ? "Verified by your coach" : message.body}
        </p>
      </div>
    );
  }
  // The unpaid/unreviewed >=3-takes card: the BE-written body ("Your full
  // transcript for X is ready.") as a grey clickable card → the Trainings
  // library. Never claims a "best presentation".
  if (message.kind === "transcript_ready") {
    const openable = !!onOpenTranscripts;
    return (
      <div
        role={openable ? "button" : undefined}
        tabIndex={openable ? 0 : undefined}
        onClick={openable ? onOpenTranscripts : undefined}
        onKeyDown={
          openable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenTranscripts!();
                }
              }
            : undefined
        }
        className={`my-1 rounded-2xl bg-chat-bot px-4 py-3 ${openable ? "cursor-pointer" : ""}`}
      >
        <p className="text-[15px] leading-relaxed text-foreground">
          {message.body}
        </p>
      </div>
    );
  }
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
  // FE-5 — the legacy per-piece Approve walker (ReadoutCard, reached through
  // InsightsOverlay) is retired under the single-deliverable model. The coach
  // insight card stays a read-only note. FE-E — the recording bubble opens its
  // OWN take's feedback page (metadata carries arc_id + session_id since the
  // draft was extended); legacy rows without arc_id stay plain history.
  const rsArcId =
    typeof message.metadata?.arc_id === "string" ? message.metadata.arc_id : null;
  const rsSessionId =
    typeof message.metadata?.session_id === "string"
      ? message.metadata.session_id
      : null;
  const rsTakeIndex =
    typeof message.metadata?.take_index === "number" &&
    Number.isFinite(message.metadata.take_index)
      ? message.metadata.take_index
      : null;
  const openable =
    message.kind === "recording_summary" &&
    !!(rsArcId && rsSessionId && onOpenFeedback);
  const open = openable
    ? () =>
        onOpenFeedback!({
          arcId: rsArcId!,
          takeSessionId: rsSessionId!,
          takeIndex: rsTakeIndex,
        })
    : undefined;
  const openKeyDown = openable
    ? (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open?.();
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
              // P11 — royal purple (founder 2026-07-11).
              className="w-full rounded-full bg-purple-700 px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-purple-600"
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


/* -------------------------------------------------------------------------- */
/*  FE-C — the crucial bubble: the app's ONE deliverable, rendered large.      */
/*  Pulls the live SD GET on mount (free for the owner, never 402s) so the     */
/*  title / status / version / date reflect the document as it is NOW, not as  */
/*  it was when the bubble row was written. Falls back gracefully while the    */
/*  fetch is in flight or when the BE's additive fields are not deployed yet.  */
/* -------------------------------------------------------------------------- */
function CrucialIdealTextCard({
  arcId,
  onOpen,
}: {
  arcId: string;
  onOpen: () => void;
}) {
  const [live, setLive] = useState<{
    title: string | null;
    updatedAt: string | null;
    status: "unverified" | "verified" | null;
    version: number | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void fetchIdealText(arcId).then((r) => {
      if (!active || r.kind !== "single") return;
      setLive({
        title: r.title,
        updatedAt: r.updatedAt,
        status: r.status,
        version: r.version,
      });
    });
    return () => {
      active = false;
    };
  }, [arcId]);

  const verified = live?.status === "verified";
  const dateLabel = live?.updatedAt
    ? new Date(live.updatedAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  return (
    <div className="my-2 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 px-5 py-6 text-white shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 shrink-0 text-amber-300" aria-hidden />
            <p className="truncate text-[19px] font-semibold leading-snug">
              {live?.title ?? "Your ideal text"}
            </p>
          </div>
          {dateLabel ? (
            <p className="mt-1 text-[12px] text-white/70">
              Last updated {dateLabel}
            </p>
          ) : null}
        </div>
        {live?.version !== null && live?.version !== undefined ? (
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[13px] font-semibold tabular-nums">
            {live.version}.0
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${
            verified ? "bg-emerald-400/25 text-emerald-100" : "bg-white/15 text-white/85"
          }`}
        >
          {verified ? "Verified" : "Not verified"}
        </span>
      </div>
      <Button
        type="button"
        onClick={onOpen}
        className="mt-5 h-12 w-full rounded-full bg-white text-[15px] font-semibold text-indigo-700 hover:bg-white/90"
      >
        Open your ideal text
      </Button>
    </div>
  );
}
