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
  type ReadoutSlide,
  type ReadoutSlideGroup,
  type ReadoutSnippet,
} from "./readout";

/** A readout page. In per-deck-slide mode (BE slide_transcripts present) each
 *  page is one DECK SLIDE carrying its COMPLETE 1:1 transcript + the slide's
 *  span in the parent recording; the per-snippet acoustic moments stack below.
 *  In the legacy fallback (no slide_transcripts) fullTranscript is null and the
 *  page is a single snippet, exactly as before. */
type ReadoutPage = ReadoutSlideGroup & {
  fullTranscript: string | null;
  fullAudioRef: string | null;
  fullStartOffsetMs: number;
  fullDurationMs: number;
};

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

/** A single toggle key for a per-deck-slide page's transcript card. */
function slideToggleKey(g: ReadoutPage): string {
  return `slide:${g.slideIndex ?? "g"}`;
}

/** Only the metrics MetricsBlock actually renders — so the chevron never
 *  promises a reveal that expands to an empty block. */
function snippetHasMetrics(f: ReadoutFeatures): boolean {
  return (
    f.f0Mean != null ||
    f.f0Sd != null ||
    f.meanPause != null ||
    f.loudnessRange != null ||
    f.voicedRatio != null
  );
}

/** Does this snippet have anything behind the chevron (coach / metrics / breakthrough)? */
function snippetHasReveal(s: ReadoutSnippet): boolean {
  return !!(
    s.coach?.note ||
    s.coach?.when ||
    (s.coach?.examples && s.coach.examples.length > 0) ||
    snippetHasMetrics(s.features) ||
    s.breakthrough
  );
}

/** The toggle keys present on a page (drives the Back-collapse gesture). One
 *  key per deck slide in per-slide mode; one per moment in the legacy view. */
function pageToggleKeys(g: ReadoutPage): string[] {
  if (g.fullTranscript !== null) return [slideToggleKey(g)];
  return g.snippets.map(momentKey);
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
  // The deck slide (index/title/body) by index — top-level `slides` first, with
  // per-snippet `slide` as a fallback for the title/body text-card path.
  const slidesByIndex = useMemo(() => {
    const m = new Map<number, ReadoutSlide>();
    for (const s of payload.slides) m.set(s.index, s);
    for (const sn of payload.snippets) {
      if (sn.slide && !m.has(sn.slide.index)) m.set(sn.slide.index, sn.slide);
    }
    return m;
  }, [payload.slides, payload.snippets]);

  // The parent recording's audio — shared across snippets, so a slide with no
  // salient snippet (e.g. the quiet first slide) can still play its own span.
  const parentAudioRef = useMemo(
    () => payload.snippets.find((s) => s.audioRef)?.audioRef ?? null,
    [payload.snippets]
  );

  // Pagination model. When the BE sends complete per-slide transcripts we page
  // per DECK SLIDE (slide + its full 1:1 transcript + its acoustic moments) —
  // every slide gets a page, so the quiet first slide is never dropped. Without
  // them we keep the legacy one-snippet-per-page view.
  const groups = useMemo((): ReadoutPage[] => {
    if (payload.slideTranscripts.length > 0) {
      const txIndices = new Set(payload.slideTranscripts.map((t) => t.index));
      const pages: ReadoutPage[] = payload.slideTranscripts.map((st) => ({
        slideIndex: st.index,
        slide: slidesByIndex.get(st.index) ?? null,
        snippets: payload.snippets.filter((s) => s.slide?.index === st.index),
        fullTranscript: st.transcript,
        fullAudioRef: parentAudioRef,
        fullStartOffsetMs: st.startOffsetMs,
        fullDurationMs: st.durationMs,
      }));
      // Catch-all so a moment whose slide has no transcript entry (or no slide
      // at all) is never silently dropped — rendered as a legacy moments page.
      const leftover = payload.snippets.filter(
        (s) => !(s.slide && txIndices.has(s.slide.index))
      );
      if (leftover.length > 0) {
        pages.push({
          slideIndex: null,
          slide: null,
          snippets: leftover,
          fullTranscript: null,
          fullAudioRef: null,
          fullStartOffsetMs: 0,
          fullDurationMs: 0,
        });
      }
      return pages;
    }
    return payload.snippets.map((s) => ({
      slideIndex: s.slide?.index ?? null,
      slide: s.slide,
      snippets: [s],
      fullTranscript: null,
      fullAudioRef: null,
      fullStartOffsetMs: 0,
      fullDurationMs: 0,
    }));
  }, [payload.slideTranscripts, payload.snippets, slidesByIndex, parentAudioRef]);
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
    // On the summary page the cursor sits PAST the last group (i clamps down),
    // so there's no on-screen card to collapse — empty keys → Back pages off the
    // summary instead of silently collapsing a now-offscreen moment.
    const onRealPage = cursorRef.current === i;
    const currentKeys = onRealPage && gs[i] ? pageToggleKeys(gs[i]) : [];
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
  group: ReadoutPage;
  presentationRef: string | null;
  isSample: boolean;
  expanded: string[];
  onToggle: (key: string) => void;
}) {
  // Per-deck-slide mode: the page carries the slide's COMPLETE transcript.
  const perSlide = group.fullTranscript !== null;
  // The deck page index to render: the slide's own index, or (per-slide mode)
  // the page's slideIndex even when no `slides` entry carried title/body — the
  // PDF page renders off presentationRef + index alone, so the quiet first
  // slide still shows its image.
  const slidePageIndex =
    group.slide?.index ?? (perSlide ? group.slideIndex : null);
  return (
    <div className="flex flex-col">
      {/* Slide — edge-to-edge, once per group (never repeated per moment) */}
      {slidePageIndex !== null ? (
        <div className="w-full bg-muted">
          <SlideRender
            presentationRef={presentationRef}
            pageIndex={slidePageIndex}
            title={group.slide?.title ?? ""}
            body={group.slide?.body ?? ""}
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

        {perSlide ? (
          // Per deck slide: the COMPLETE 1:1 transcript + slide playback shown
          // exactly once (each slide's speech is distinct — never repeated).
          <DeckSlideContent
            group={group}
            isOpen={expanded.includes(slideToggleKey(group))}
            onToggle={() => onToggle(slideToggleKey(group))}
          />
        ) : (
          group.snippets.map((s) => {
            const key = momentKey(s);
            return (
              <MomentRow
                key={key}
                snippet={s}
                isOpen={expanded.includes(key)}
                onToggle={() => onToggle(key)}
              />
            );
          })
        )}
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
  const hasReveal = snippetHasReveal(snippet);

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

      {/* Per-moment playback — always visible (play back what you said here) */}
      {snippet.audioRef ? (
        <MediaPlayer
          src={snippet.audioRef}
          startOffsetMs={snippet.startOffsetMs}
          durationMs={snippet.durationMs}
        />
      ) : null}

      {isOpen && hasReveal ? <SnippetDetail snippet={snippet} /> : null}
    </div>
  );
}

/* ── per deck slide: complete transcript (once) + slide playback + detail ── */

function DeckSlideContent({
  group,
  isOpen,
  onToggle,
}: {
  group: ReadoutPage;
  isOpen: boolean;
  onToggle: () => void;
}) {
  // Each slide's speech is distinct, so the transcript is shown ONCE here — no
  // per-moment transcript cards repeating it. The chevron reveals the acoustic
  // detail (metrics / coach / breakthrough) for the slide's moments.
  const detailSnippets = group.snippets.filter(snippetHasReveal);
  const hasReveal = detailSnippets.length > 0;
  return (
    <>
      {group.fullTranscript ? (
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
          <p className="flex-1 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
            {group.fullTranscript}
          </p>
          {hasReveal ? (
            <ChevronDown
              className={`mt-0.5 h-5 w-5 shrink-0 text-primary transition-transform ${isOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          ) : null}
        </div>
      ) : (
        <p className="text-[14px] italic text-muted-foreground">
          No speech recorded on this slide.
        </p>
      )}

      {/* Play back the whole slide — once (parent recording, clamped to its span). */}
      {group.fullAudioRef && group.fullDurationMs > 0 ? (
        <MediaPlayer
          src={group.fullAudioRef}
          startOffsetMs={group.fullStartOffsetMs}
          durationMs={group.fullDurationMs}
        />
      ) : null}

      {/* Acoustic detail for the slide's moments — no transcript / player repeat. */}
      {isOpen && hasReveal ? (
        <div className="flex flex-col gap-5">
          {detailSnippets.map((s) => (
            <SnippetDetail key={momentKey(s)} snippet={s} />
          ))}
        </div>
      ) : null}
    </>
  );
}

/* ── the in-place reveal: coach comment → metrics → breakthrough (no transcript) ── */

function SnippetDetail({ snippet }: { snippet: ReadoutSnippet }) {
  return (
    <div className="flex flex-col gap-4">
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

      {snippetHasMetrics(snippet.features) ? (
        <MetricsBlock features={snippet.features} />
      ) : null}

      {snippet.breakthrough ? (
        <BreakthroughBlock videoRef={snippet.breakthroughVideoRef} />
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
