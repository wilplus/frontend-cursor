"use client";

import { useEffect, useState } from "react";
import { Check, Crown, FileText, Mic, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PENDING_VERIFICATION, REVIEWED } from "@/lib/willab/verificationCopy";
import { fetchIdealText } from "@/services/api/idealText";
import {
  cachedIdealTitle,
  rememberIdealTitle,
} from "@/lib/willab/idealTitleCache";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { bestPresentationView, insightView, readoutView } from "./loungeReports";
import ArcActionPrice from "@/components/tokens/ArcActionPrice";

/* -------------------------------------------------------------------------- */
/*  ReportCard — persisted Readout / Insight / Ideal-Text cards (C2 taxonomy)   */
/*                                                                            */
/*  Strict 3-tier system (rule: orange = USER only; system/coach = grey,        */
/*  EXCEPT the ideal-text hero):                                               */
/*    recording_summary  → USER: short ORANGE voice-message bubble, right-      │
/*                         aligned. "Your Recording {name}, take {n}, {date}".  */
/*    insight            → COACH: GREY, 85%-wide. "Feedback on {name}, …".      */
/*    best_presentation_ready → the HERO: full-width indigo/violet card, gold   │
/*                         crown, "Ideal Text for {name} is ready!", with both  */
/*                         historical Ideal Text card.                          */
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
  onOpenTranscripts,
  onOpenFeedback,
  onOpenIdealText,
}: {
  message: LoungeMessage;
  onViewInsights?: (sessionId: string) => void;
  onOpenBestPresentation?: (arcId: string) => void;
  /** transcript_ready — opens the Trainings library (where transcripts live). */
  onOpenTranscripts?: () => void;
  /** Delivery layer — a grey feedback bubble opens its take's feedback page. */
  onOpenFeedback?: (target: FeedbackBubbleTarget) => void;
  /** Delivery layer — the purple bubble opens the ideal-text notebook.
   *  ALWAYS the live, editable document — version bubbles are history markers,
   *  not frozen read-only destinations (founder 2026-07-29). */
  onOpenIdealText?: (arcId: string) => void;
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
        className={`my-1 mr-auto max-w-[85%] rounded-2xl bg-chat-bot px-4 py-3 ${openable ? "cursor-pointer" : ""}`}
      >
        <p className="flex items-baseline justify-between gap-3 text-[15px] leading-relaxed text-foreground">
          <span className="font-semibold">
            Feedback{takeIndex != null ? ` · Take ${takeIndex}` : ""}
          </span>
          {/* Price BEFORE opening — this bubble is the trigger, and the overlay
              it opens is what gets charged. Shown only while this arc still
              owes the `insights` charge; once paid it is free forever and the
              price disappears rather than lingering as a wrong label. */}
          {arcId ? <ArcActionPrice arcId={arcId} action="insights" /> : null}
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
    // Every bubble opens the SAME live, editable notebook — the version on
    // the card is a history marker, never a frozen destination.
    const open = () => {
      if (arcId && onOpenIdealText) onOpenIdealText(arcId);
    };
    const verified = message.metadata?.variant === "verified";
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
          className={`my-1 mr-auto max-w-[85%] rounded-2xl border border-primary/30 bg-chat-bot px-4 py-3 ${
            openable ? "cursor-pointer" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p className="text-[15px] font-semibold leading-snug text-foreground">
              Instant ideal text
            </p>
          </div>
          {/* Title + date, same rule as the version cards (founder
              2026-08-05): a bubble is read once on arrival and a hundred
              times on scroll-back, so the BE's prose does not live here. */}
          {reportDateLabel(message.client_created_at) ? (
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              {reportDateLabel(message.client_created_at)}
            </p>
          ) : null}
        </div>
      );
    }
    // FE-2 — EVERY version is its own bubble in the chat flow (nothing pinned),
    // a FIXED history entry: the project's name as the title, its own version
    // badge, the BE's sentence as the meta line. Only the STATUS pill may
    // change after the fact (pending → reviewed once this version verifies).
    return (
      <LiveStatusIdealTextCard
        arcId={arcId}
        /* THE ROW CARRIES ITS OWN NAME (backend-cursor, 2026-08-15). The BE
         * now stamps the project's topic when it writes the bubble, so a
         * brand-new card is correct on its FIRST paint with no request at
         * all. Absent on every row written before that change — those fall
         * through to the remembered title, then the generic. */
        stampedTitle={
          typeof message.metadata?.topic === "string"
            ? message.metadata.topic
            : null
        }
        version={version}
        frozenVerified={verified}
        // The DATE, not message.body. The BE's sentence used to sit here;
        // founder 2026-08-05 cut it to "just the title, date and the CTA".
        date={reportDateLabel(message.client_created_at)}
        onOpen={openable ? open : null}
      />
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
        className={`my-1 mr-auto max-w-[85%] rounded-2xl bg-chat-bot px-4 py-3 ${openable ? "cursor-pointer" : ""}`}
      >
        <p className="text-[15px] leading-relaxed text-foreground">
          {message.body}
        </p>
      </div>
    );
  }
  // The historical ready message now opens the canonical Ideal Text artifact.
  if (message.kind === "best_presentation_ready") {
    const v = bestPresentationView(message.metadata);
    return (
      <IdealTextHeroCard
        name={v.topic}
        arcId={v.arcId}
        onOpenBestPresentation={onOpenBestPresentation}
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
    // COACH feedback — GREY, capped at max-w-[85%] like the coach bubbles.
    const v = insightView(message.metadata);
    const detail = detailLine(v.topic, v.takeIndex, date);
    return (
      <div
        role={openable ? "button" : undefined}
        tabIndex={openable ? 0 : undefined}
        onClick={openable ? open : undefined}
        onKeyDown={openKeyDown}
        className={`my-1 mr-auto max-w-[85%] rounded-2xl bg-chat-bot px-4 py-3 ${openable ? "cursor-pointer" : ""}`}
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
}: {
  name: string | null;
  arcId: string | null;
  onOpenBestPresentation?: (arcId: string) => void;
}) {
  const canBest = !!(arcId && onOpenBestPresentation);
  return (
    <div className="my-1 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 px-4 py-4 text-white shadow-sm">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
        <p className="text-[16px] font-semibold leading-snug">
          Ideal Text{name ? <span> for {name}</span> : null} is ready!
        </p>
      </div>
      {canBest ? (
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onOpenBestPresentation!(arcId!)}
            className="w-full rounded-full bg-purple-700 px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-purple-600"
          >
            View Ideal Text
          </button>
        </div>
      ) : null}
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/*  FE-C — the crucial bubble: the app's ONE deliverable, a tall grey card.    */
/*  Pulls the live SD GET on mount (free for the owner, never 402s). Exactly   */
/*  TWO things on the card are live: the STATUS pill (pending → reviewed) and  */
/*  the TITLE (founder 2026-07-29 — the BE stamps no name on the bubble row,   */
/*  so the project name can only come from the document GET). The VERSION      */
/*  badge is frozen forever to the bubble's own version, and the meta line is  */
/*  the BE's sentence as written. This block used to claim version and date    */
/*  were live too, which was never true of version — corrected 2026-07-30.     */
/*  Falls back gracefully while the fetch is in flight or when the BE's        */
/*  additive fields are not deployed yet.                                      */
/* -------------------------------------------------------------------------- */
/** IDEAL RECORDING card (token-mapped restyle) — the ideal-text bubble as a
 *  coach attachment. Bottom-left tail so it reads as a coach message; a distinct
 *  `bg-card` surface + border/shadow so it stands out from the grey text bubbles
 *  as an artifact. Colours map to theme tokens (success = verified); the app has
 *  no amber token, so the unverified pill uses a dark-safe amber (informational,
 *  never red). Presentation only — the caller owns all data + the open handler. */
function IdealRecordingCard({
  title,
  meta,
  badge,
  verified,
  ctaLabel,
  onOpen,
}: {
  title: string;
  /** The DATE line under the title. null hides it.
   *
   *  Founder 2026-08-05: this used to carry the BE's sentence, which on takes
   *  1 and 2 was "your ideal text gets sharper with more takes — three is
   *  where it really lands". That is gone. "not text that it really lands on
   *  the 3rd time; on the bubble never; just the title, date and the CTA." */
  meta: string | null;
  /** The version badge, e.g. "2.0" — the take this version came from. */
  badge: string | null;
  verified: boolean;
  ctaLabel: string;
  /** null → no CTA (an un-openable historical bubble). */
  onOpen: (() => void) | null;
}) {
  return (
    <div className="my-2 mr-auto max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,15,15,0.04),0_8px_24px_-12px_rgba(15,15,15,0.12)]">
      {/* Header: icon tile + title/date + version chip. The uppercase
          "IDEAL RECORDING" attachment label sat above this; it went with the
          minimisation — the icon tile already says "artifact, not chat", and
          the founder's list is title, date, CTA. */}
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
          <FileText className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold leading-snug tracking-tight text-foreground">
            {title}
          </p>
          {meta ? (
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {meta}
            </p>
          ) : null}
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold tabular-nums text-foreground">
            {badge}
          </span>
        ) : null}
      </div>
      {/* Reviewed / pending pill (amber = informational, never red). */}
      <div className="mt-4">
        {verified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[12px] font-medium text-success ring-1 ring-success/25">
            <Check className="h-3.5 w-3.5" aria-hidden />
            {REVIEWED}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/25">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            {PENDING_VERIFICATION}
          </span>
        )}
      </div>
      {/* CTA — rounded-xl to echo the icon tile + card corners. */}
      {onOpen ? (
        <Button
          type="button"
          onClick={onOpen}
          className="mt-4 h-11 w-full rounded-xl bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90 active:scale-[0.99]"
        >
          <Sparkles className="mr-2 h-4 w-4" aria-hidden />
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Founder 2026-07-29 — version bubbles are FIXED history entries. The one    */
/*  live thing on a card is its status pill (pending → reviewed) plus the      */
/*  project's NAME as the title (the BE stamps no name on the bubble row, so   */
/*  it comes from the document GET). One GET per arc feeds every bubble of a   */
/*  long version history via this small cache; a fresh mount after 60s        */
/*  refetches so a coach verification actually shows up.                       */
/* -------------------------------------------------------------------------- */

interface LiveIdealDoc {
  title: string | null;
  status: "unverified" | "verified" | null;
  version: number | null;
}

const liveDocCache = new Map<
  string,
  { at: number; promise: Promise<LiveIdealDoc | null> }
>();

function fetchLiveIdealDoc(arcId: string): Promise<LiveIdealDoc | null> {
  const hit = liveDocCache.get(arcId);
  if (hit && Date.now() - hit.at < 60_000) return hit.promise;
  const promise = fetchIdealText(arcId).then((r) =>
    r.kind === "single"
      ? { title: r.title, status: r.status, version: r.version }
      : null
  );
  liveDocCache.set(arcId, { at: Date.now(), promise });
  return promise;
}

function LiveStatusIdealTextCard({
  arcId,
  stampedTitle,
  version,
  frozenVerified,
  date,
  onOpen,
}: {
  arcId: string | null;
  /** The project name the BE stamped on this row at write time. Null on rows
   *  written before 2026-08-15 — the cache and then the generic cover those. */
  stampedTitle: string | null;
  /** The bubble's OWN version — fixed forever, never the live document's.
   *  Since founder 2026-08-05 the version IS the take: take 1 → 1.0, take
   *  2 → 2.0, each with its own verification. */
  version: number | null;
  /** True when the BE wrote this bubble as a verified one (variant). */
  frozenVerified: boolean;
  /** The bubble's own date, from its FE-stamped timestamp. */
  date: string | null;
  onOpen: (() => void) | null;
}) {
  const [live, setLive] = useState<LiveIdealDoc | null>(null);
  /* THE NAME IS KNOWN BEFORE THE FETCH (founder 2026-08-15: "first they
   * display the placeholder and only later load the database's name — can you
   * make it just a solid bubble").
   *
   * The document GET is the only source of the project's name (the BE stamps
   * none on the bubble row), so every card rendered "Your ideal text" and
   * swapped a moment later. On a thread with a version history that is a
   * column of placeholders all flipping at once, on every app open.
   *
   * Seeded from the cache with a LAZY initializer, so it is read once at mount
   * rather than on every render, and the very first paint already carries the
   * real name. The fetch still runs and still wins — this removes the wrong
   * words, not the revalidation. */
  const [cachedTitle] = useState<string | null>(() => cachedIdealTitle(arcId));
  /* A stamped title is worth remembering too: it warms the cache for the
   * OLDER bubbles of the same arc sitting above it in the thread, which have
   * no stamp of their own and would otherwise each wait on the fetch. */
  useEffect(() => {
    if (arcId && stampedTitle?.trim()) rememberIdealTitle(arcId, stampedTitle);
  }, [arcId, stampedTitle]);
  useEffect(() => {
    if (!arcId) return;
    let active = true;
    void fetchLiveIdealDoc(arcId).then((d) => {
      // Remembered even if this card unmounted mid-flight: the answer is about
      // the ARC, and the next bubble to mount should not have to ask again.
      rememberIdealTitle(arcId, d?.title);
      if (active) setLive(d);
    });
    return () => {
      active = false;
    };
  }, [arcId]);
  // The status pill is the one mutable thing: a pending bubble flips to
  // reviewed once the live document verifies THIS version.
  const verified =
    frozenVerified ||
    (live?.status === "verified" &&
      live.version !== null &&
      live.version === version);
  return (
    <IdealRecordingCard
      /* Live → stamped-on-the-row → remembered → the generic. The generic is
       * the honest answer ONLY for an arc nobody has ever opened and whose
       * bubble predates the stamp; everywhere else it was just the wrong
       * words shown first. */
      title={
        live?.title?.trim() ||
        stampedTitle?.trim() ||
        cachedTitle ||
        "Your ideal text"
      }
      meta={date}
      badge={version !== null ? `${version}.0` : null}
      verified={verified}
      ctaLabel="Open your ideal text"
      onOpen={onOpen}
    />
  );
}
