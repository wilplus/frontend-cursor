"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Play } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import { SlideRender } from "./pdfSlides";
import SnippetScreenShell from "./SnippetScreenShell";
import {
  decideReadoutBack,
  type ReadoutFeatures,
  type ReadoutPayload,
  type ReadoutSlideGroup,
  type ReadoutSnippet,
} from "./readout";

/* -------------------------------------------------------------------------- */
/*  ReadoutCard — one slide per page, its spoken moments stacked below it.      */
/*  Each moment shows its transcript in the orange card; tapping "Tap to see    */
/*  the coach insight" expands the rest IN PLACE below it (player + coach        */
/*  comment + metrics + breakthrough) — no new frame, the navbar is untouched.  */
/*  Multiple moments can be open at once. Back/swipe-back collapses the most     */
/*  recently opened moment, then pages to the previous slide, then closes.      */
/* -------------------------------------------------------------------------- */

/** Stable key for a moment (BE id when present; else slide+offset). */
function momentKey(s: ReadoutSnippet): string {
  return s.id || `${s.slide?.index ?? "g"}:${s.startOffsetMs}`;
}

export default function ReadoutCard({
  payload,
  isSample = false,
  onSend,
  onClose,
  managed = true,
  onRegisterBack,
}: {
  payload: ReadoutPayload;
  isSample?: boolean;
  onSend?: () => void;
  /** Required for shell mode (full-screen overlay). Both LabOverlay and
   *  InsightsOverlay provide this. Without it the card renders a plain div. */
  onClose?: () => void;
  managed?: boolean;
  /** Lets the host wire device Back into the readout's internal layout stack
   *  (collapse → page → close). The host passes this and feeds the returned
   *  handler to useBackDismiss as its onBack. */
  onRegisterBack?: (handler: () => boolean) => void;
}) {
  // One snippet per page (slide-per-slide, not bundled): each snippet is its
  // own page — its slide on top, its text below, paged via the Back/Next bar.
  const groups = useMemo(
    (): ReadoutSlideGroup[] =>
      payload.snippets.map((s) => ({
        slideIndex: s.slide?.index ?? null,
        slide: s.slide,
        snippets: [s],
      })),
    [payload.snippets]
  );
  const groupCount = groups.length;
  const [cursor, setCursor] = useState(0);
  // Keys of expanded moments, in open order (newest last) — drives Back.
  const [expanded, setExpanded] = useState<string[]>([]);

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const toggle = useCallback((key: string) => {
    setExpanded((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  // Device Back: collapse the newest expanded moment on the current slide, else
  // page back, else (return false) let the host close the overlay.
  const handleBack = useCallback((): boolean => {
    const gs = groupsRef.current;
    const i = Math.min(cursorRef.current, Math.max(gs.length - 1, 0));
    const currentKeys = (gs[i]?.snippets ?? []).map(momentKey);
    const action = decideReadoutBack(
      cursorRef.current,
      expandedRef.current,
      currentKeys
    );
    if (action.type === "collapse") {
      setExpanded((prev) => prev.filter((k) => k !== action.key));
      return true;
    }
    if (action.type === "page") {
      setCursor((c) => Math.max(c - 1, 0));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    onRegisterBack?.(handleBack);
  }, [onRegisterBack, handleBack]);

  const hasSummaryPage = !!(
    onClose && (payload.overallMessage || payload.videoRef)
  );
  const shellTotal = hasSummaryPage
    ? Math.max(groupCount, 1) + 1
    : Math.max(groupCount, 1);
  const idx = Math.min(cursor, Math.max(groupCount - 1, 0));
  const atSummary = hasSummaryPage && cursor === shellTotal - 1;
  const atLast = cursor === shellTotal - 1;

  if (!onClose) {
    if (groupCount === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-[15px] text-muted-foreground">
            No analyzable snippets in this recording.
          </p>
        </div>
      );
    }
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        {groups.map((g, i) => (
          <SlideGroupPage
            key={g.slideIndex ?? `general-${i}`}
            group={g}
            presentationRef={payload.presentationRef}
            isSample={isSample && i === 0}
            expanded={expanded}
            onToggle={toggle}
          />
        ))}
      </div>
    );
  }

  function handleNext() {
    if (!atLast) {
      setCursor((c) => c + 1);
    } else if (!hasSummaryPage && onSend) {
      onSend(); // pre-send readout: last page sends the take
    } else if (onClose) {
      onClose(); // viewer: last page closes the layer
    }
  }

  return (
    <SnippetScreenShell
      onClose={onClose}
      index={cursor}
      total={shellTotal}
      onPrev={() => setCursor((c) => Math.max(c - 1, 0))}
      onNext={handleNext}
      nextLabel={
        atLast ? (!hasSummaryPage && onSend ? "Send for analysis" : "Close") : undefined
      }
      nextTone={atLast ? "terminal" : "primary"}
      managed={managed}
    >
      {atSummary ? (
        <SummaryPage payload={payload} />
      ) : groupCount === 0 ? (
        <p className="px-4 py-12 text-center text-[15px] text-muted-foreground">
          No analyzable snippets in this recording.
        </p>
      ) : (
        <SlideGroupPage
          group={groups[idx]}
          presentationRef={payload.presentationRef}
          isSample={isSample && idx === 0}
          expanded={expanded}
          onToggle={toggle}
        />
      )}
    </SnippetScreenShell>
  );
}

/* ── one slide + its stacked spoken moments ── */

function SlideGroupPage({
  group,
  presentationRef,
  isSample,
  expanded,
  onToggle,
}: {
  group: ReadoutSlideGroup;
  presentationRef: string | null;
  isSample: boolean;
  expanded: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Slide — edge-to-edge, once per group (never repeated per moment) */}
      {group.slide ? (
        <div className="w-full bg-muted">
          <SlideRender
            presentationRef={presentationRef}
            pageIndex={group.slide.index}
            title={group.slide.title}
            body={group.slide.body}
            className="w-full"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 px-4 py-4">
        {isSample ? (
          <p className="rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-[12px] text-primary">
            Sample data — your real acoustic Training Profile wires in at seam
            ③.
          </p>
        ) : null}

        {group.snippets.map((s) => {
          const key = momentKey(s);
          return (
            <MomentRow
              key={key}
              snippet={s}
              isOpen={expanded.includes(key)}
              onToggle={() => onToggle(key)}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── one spoken moment: transcript card + in-place expand ── */

function MomentRow({
  snippet,
  isOpen,
  onToggle,
}: {
  snippet: ReadoutSnippet;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const hasMetrics = Object.values(snippet.features).some((v) => v != null);
  const hasReveal = !!(
    snippet.audioRef ||
    snippet.coach?.note ||
    snippet.coach?.when ||
    (snippet.coach?.examples && snippet.coach.examples.length > 0) ||
    hasMetrics ||
    snippet.breakthrough
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Transcript — the orange card; the whole card toggles the reveal */}
      {snippet.transcript ? (
        <div
          role={hasReveal ? "button" : undefined}
          tabIndex={hasReveal ? 0 : undefined}
          onClick={hasReveal ? onToggle : undefined}
          onKeyDown={
            hasReveal
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") onToggle();
                }
              : undefined
          }
          aria-expanded={hasReveal ? isOpen : undefined}
          className={`flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3 ${hasReveal ? "cursor-pointer" : ""}`}
        >
          <p className="flex-1 text-[15px] leading-relaxed text-foreground">
            {snippet.transcript}
          </p>
          {hasReveal ? (
            <ChevronDown
              className={`mt-0.5 h-5 w-5 shrink-0 text-primary transition-transform ${isOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          ) : null}
        </div>
      ) : null}

      {/* Expanded, in place: player → coach comment → metrics → breakthrough */}
      {isOpen && hasReveal ? (
        <div className="flex flex-col gap-4">
          {snippet.audioRef ? (
            <MediaPlayer
              src={snippet.audioRef}
              startOffsetMs={snippet.startOffsetMs}
              durationMs={snippet.durationMs}
            />
          ) : null}

          {snippet.coach?.note ? (
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
              {snippet.coach.note}
            </p>
          ) : null}
          {snippet.coach?.when ? (
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-muted-foreground">
              {snippet.coach.when}
            </p>
          ) : null}
          {snippet.coach?.examples && snippet.coach.examples.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {snippet.coach.examples.map((ex, i) => (
                <p key={i} className="text-[14px] text-foreground">
                  {ex}
                </p>
              ))}
            </div>
          ) : null}

          {hasMetrics ? <MetricsBlock features={snippet.features} /> : null}

          {snippet.breakthrough ? (
            <BreakthroughBlock videoRef={snippet.breakthroughVideoRef} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ── breakthrough — headline + note + (pending BE) per-snippet video ── */

function BreakthroughBlock({ videoRef }: { videoRef: string | null }) {
  // The explanation IS the coach comment (shown above in the expanded moment);
  // this block adds the celebratory headline + the coach's separate video.
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-primary/[0.08] px-4 py-4">
      <p className="text-[15px] font-semibold text-foreground">
        🥳 Here you turned your stress into charisma!
      </p>
      {videoRef ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={videoRef} controls playsInline className="w-full bg-black" />
        </div>
      ) : null}
    </div>
  );
}

/* ── metrics block (PITCH / PACE & PAUSES / VOLUME & VOICE) ── */

function MetricsBlock({ features: f }: { features: ReadoutFeatures }) {
  const hz = (v: number | null) => (v != null ? `${Math.round(v)} Hz` : "-");
  const sec = (v: number | null) => (v != null ? `${v.toFixed(1)}s` : "-");
  const db = (v: number | null) => (v != null ? `${Math.round(v)} dB` : "-");
  const pct = (v: number | null) =>
    v != null ? `${Math.round(v * 100)}%` : "-";

  return (
    <div className="flex flex-col gap-1.5 text-[15px] leading-relaxed text-foreground">
      {f.f0Mean != null || f.f0Sd != null ? (
        <p>
          <span className="font-semibold">PITCH</span> F0 mean {hz(f.f0Mean)} ·
          SD {hz(f.f0Sd)}
        </p>
      ) : null}
      {f.meanPause != null ? (
        <p>
          <span className="font-semibold">{"PACE & PAUSES"}</span> mean pause{" "}
          {sec(f.meanPause)}
        </p>
      ) : null}
      {f.loudnessRange != null || f.voicedRatio != null ? (
        <p>
          <span className="font-semibold">{"VOLUME & VOICE"}</span> range{" "}
          {db(f.loudnessRange)} · voiced {pct(f.voicedRatio)}
        </p>
      ) : null}
    </div>
  );
}

/* ── summary page (post-coach, after all slides) ── */

function SummaryPage({ payload }: { payload: ReadoutPayload }) {
  const [breakthroughOpen, setBreakthroughOpen] = useState(false);
  const breakthroughRef = useRef<HTMLDivElement>(null);
  const hasBreakthrough = payload.snippets.some((s) => s.breakthrough);

  function toggleBreakthrough() {
    setBreakthroughOpen((v) => {
      if (!v) {
        setTimeout(
          () =>
            breakthroughRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            }),
          50
        );
      }
      return !v;
    });
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-8">
      {payload.overallMessage ? (
        <div className="rounded-2xl bg-primary/[0.10] p-4">
          <p className="whitespace-pre-line text-[17px] leading-relaxed text-foreground">
            {payload.overallMessage}
          </p>
        </div>
      ) : null}

      {payload.videoRef ? <CoachVideoCard src={payload.videoRef} /> : null}

      {hasBreakthrough ? (
        <>
          <button
            type="button"
            onClick={toggleBreakthrough}
            className="w-full rounded-xl bg-foreground px-4 py-3 text-[15px] font-semibold text-background"
          >
            {breakthroughOpen
              ? "Close breakthrough"
              : "Explore your breakthrough moment!"}
          </button>
          {breakthroughOpen ? (
            <div ref={breakthroughRef} className="flex flex-col gap-3">
              {payload.snippets
                .filter((s) => s.breakthrough)
                .map((s, i) => (
                  <BreakthroughBlock
                    key={s.id || String(i)}
                    videoRef={s.breakthroughVideoRef}
                  />
                ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ── coach video card (session-level) ── */

function CoachVideoCard({ src }: { src: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 self-start rounded-full border border-border px-4 py-2 text-[14px] text-foreground transition-colors hover:border-primary/50"
      >
        <Play className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        Watch your coach&apos;s note
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video src={src} controls autoPlay playsInline className="w-full bg-black" />
    </div>
  );
}
