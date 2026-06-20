"use client";

import { useMemo, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import { SlideRender } from "./pdfSlides";
import SnippetScreenShell from "./SnippetScreenShell";
import { useBackDismiss } from "./useBackDismiss";
import {
  groupSnippetsBySlide,
  type ReadoutFeatures,
  type ReadoutPayload,
  type ReadoutSlideGroup,
  type ReadoutSnippet,
} from "./readout";

/* -------------------------------------------------------------------------- */
/*  ReadoutCard — Design B: one slide per page, its spoken moments stacked     */
/*  below it chronologically (text only). Playback + the coach comment live in */
/*  a tap-in detail sheet, opened by tapping a moment or its orange "See        */
/*  comment" tab. Breakthrough stays inline on the moment it belongs to.       */
/* -------------------------------------------------------------------------- */

export default function ReadoutCard({
  payload,
  isSample = false,
  onSend,
  onClose,
  managed = true,
}: {
  payload: ReadoutPayload;
  isSample?: boolean;
  onSend?: () => void;
  /** Required for shell mode (full-screen overlay). Both LabOverlay and
   *  InsightsOverlay provide this. Without it the card renders a plain div. */
  onClose?: () => void;
  managed?: boolean;
}) {
  const groups = useMemo(
    () => groupSnippetsBySlide(payload.snippets),
    [payload.snippets]
  );
  const groupCount = groups.length;
  const [cursor, setCursor] = useState(0);
  // The moment whose tap-in detail sheet is open (playback + coach comment).
  const [openSnippet, setOpenSnippet] = useState<ReadoutSnippet | null>(null);

  const hasSummaryPage = !!(
    onClose && (payload.overallMessage || payload.videoRef)
  );
  const shellTotal = hasSummaryPage
    ? Math.max(groupCount, 1) + 1
    : Math.max(groupCount, 1);
  const idx = Math.min(cursor, Math.max(groupCount - 1, 0));
  const atSummary = hasSummaryPage && cursor === shellTotal - 1;
  const atLast = cursor === shellTotal - 1;
  const isLastGroup = !hasSummaryPage && atLast;

  const sheet = openSnippet ? (
    <SnippetDetailSheet
      snippet={openSnippet}
      presentationRef={payload.presentationRef}
      onClose={() => setOpenSnippet(null)}
    />
  ) : null;

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
            onOpenSnippet={setOpenSnippet}
          />
        ))}
        {sheet}
      </div>
    );
  }

  function handleNext() {
    if (atLast) {
      if (!hasSummaryPage && onSend) onSend();
    } else {
      setCursor((c) => c + 1);
    }
  }

  return (
    <>
      <SnippetScreenShell
        onClose={onClose}
        index={cursor}
        total={shellTotal}
        onPrev={() => setCursor((c) => Math.max(c - 1, 0))}
        onNext={handleNext}
        nextLabel={isLastGroup && onSend ? "Send for analysis" : undefined}
        nextTone={isLastGroup && onSend ? "terminal" : "primary"}
        nextDisabled={isLastGroup && !onSend && groupCount > 0}
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
            onOpenSnippet={setOpenSnippet}
          />
        )}
      </SnippetScreenShell>
      {sheet}
    </>
  );
}

/* ── one slide + its stacked spoken moments (text only) ── */

function SlideGroupPage({
  group,
  presentationRef,
  isSample,
  onOpenSnippet,
}: {
  group: ReadoutSlideGroup;
  presentationRef: string | null;
  isSample: boolean;
  onOpenSnippet: (snippet: ReadoutSnippet) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Slide — edge-to-edge, once per group */}
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

        {group.snippets.map((s, i) => (
          <SnippetRow
            key={s.id || String(i)}
            snippet={s}
            onOpen={() => onOpenSnippet(s)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── one spoken moment: transcript + orange "See comment" tab (text only) ── */

function SnippetRow({
  snippet,
  onOpen,
}: {
  snippet: ReadoutSnippet;
  onOpen: () => void;
}) {
  const [breakthroughOpen, setBreakthroughOpen] = useState(false);
  const breakthroughRef = useRef<HTMLDivElement>(null);
  const hasCoachNote = !!snippet.coach?.note;

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
    <div className="flex flex-col gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3">
      {/* Transcript — the whole moment is the tap target into the detail sheet */}
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left"
        aria-label="Open this moment"
      >
        {snippet.transcript ? (
          <p className="text-[15px] leading-relaxed text-foreground">
            {snippet.transcript}
          </p>
        ) : (
          <p className="text-[14px] text-muted-foreground">View this moment</p>
        )}
      </button>

      {/* Orange bold "See comment" tab — only when the coach left a note */}
      {hasCoachNote ? (
        <button
          type="button"
          onClick={onOpen}
          className="self-start rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-bold text-primary-foreground"
        >
          See comment
        </button>
      ) : null}

      {/* Breakthrough — unchanged from Design A */}
      {snippet.breakthrough ? (
        <>
          <button
            type="button"
            onClick={toggleBreakthrough}
            className="w-full rounded-xl bg-primary px-4 py-3 text-[15px] font-semibold text-primary-foreground"
          >
            {breakthroughOpen
              ? "Close breakthrough"
              : "Explore my breakthrough moment!"}
          </button>
          {breakthroughOpen ? (
            <div
              ref={breakthroughRef}
              className="rounded-xl bg-primary/[0.08] px-4 py-4"
            >
              <p className="text-[15px] font-semibold text-foreground">
                You turned your stress into charisma.
              </p>
              {snippet.breakthroughNote ? (
                <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                  {snippet.breakthroughNote}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ── tap-in detail sheet: playback + coach comment + metrics ── */

function SnippetDetailSheet({
  snippet,
  presentationRef,
  onClose,
}: {
  snippet: ReadoutSnippet;
  presentationRef: string | null;
  onClose: () => void;
}) {
  useBackDismiss(onClose);

  return (
    <div
      role="dialog"
      aria-label="Moment detail"
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <div className="flex shrink-0 justify-end px-3 pt-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
        >
          <X className="h-[17px] w-[17px]" aria-hidden />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-10">
          {snippet.slide ? (
            <div className="w-full overflow-hidden rounded-xl bg-muted">
              <SlideRender
                presentationRef={presentationRef}
                pageIndex={snippet.slide.index}
                title={snippet.slide.title}
                body={snippet.slide.body}
                className="w-full"
              />
            </div>
          ) : null}

          {snippet.audioRef ? (
            <MediaPlayer
              src={snippet.audioRef}
              startOffsetMs={snippet.startOffsetMs}
              durationMs={snippet.durationMs}
            />
          ) : null}

          {snippet.transcript ? (
            <div className="rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3">
              <p className="text-[15px] leading-relaxed text-foreground">
                {snippet.transcript}
              </p>
            </div>
          ) : null}

          {snippet.coach?.note ? (
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-bold uppercase tracking-wide text-primary">
                Coach comment
              </p>
              <p className="text-[15px] leading-relaxed text-foreground">
                {snippet.coach.note}
              </p>
              {snippet.coach.when ? (
                <p className="text-[14px] leading-relaxed text-muted-foreground">
                  {snippet.coach.when}
                </p>
              ) : null}
              {snippet.coach.examples && snippet.coach.examples.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {snippet.coach.examples.map((ex, i) => (
                    <p key={i} className="text-[14px] text-foreground">
                      {ex}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {snippet.features ? (
            <MetricsBlock
              features={snippet.features}
              transcript={snippet.transcript}
              durationMs={snippet.durationMs}
            />
          ) : null}
        </div>
      </div>
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
          <p className="text-[17px] leading-relaxed text-foreground">
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
                  <div
                    key={s.id || String(i)}
                    className="rounded-xl bg-primary/[0.08] px-4 py-4"
                  >
                    <p className="text-[15px] font-semibold text-foreground">
                      You turned your stress into charisma.
                    </p>
                    {s.breakthroughNote ? (
                      <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                        {s.breakthroughNote}
                      </p>
                    ) : null}
                  </div>
                ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ── metrics block (shown in the tap-in detail sheet) ── */

function MetricsBlock({
  features: f,
  transcript,
  durationMs,
}: {
  features: ReadoutFeatures;
  transcript: string;
  durationMs: number;
}) {
  const hz = (v: number | null) => (v != null ? `${Math.round(v)} Hz` : "-");
  const pct = (v: number | null) =>
    v != null ? `${Math.round(v * 100)}%` : "-";
  const db = (v: number | null) => (v != null ? `${Math.round(v)} dB` : "-");

  const wpm =
    f.speechRate != null
      ? Math.round(f.speechRate)
      : (() => {
          if (durationMs <= 0) return null;
          const words = transcript.trim().split(/\s+/).filter(Boolean).length;
          return words > 0 ? Math.round(words / (durationMs / 60000)) : null;
        })();

  return (
    <div className="flex flex-col gap-1 text-[14px] leading-relaxed text-muted-foreground">
      <p>
        Pitch: F0 mean {hz(f.f0Mean)}, SD {hz(f.f0Sd)}
      </p>
      {wpm != null ? (
        <p>
          Pace: {wpm} wpm, pause {pct(f.pauseRatio)}
        </p>
      ) : null}
      {f.loudnessRange != null ? (
        <p>
          Volume: range {db(f.loudnessRange)}, voiced {pct(f.voicedRatio)}
        </p>
      ) : null}
    </div>
  );
}

/* ── coach video card ── */

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
