"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import { SlideRender } from "./pdfSlides";
import SnippetScreenShell from "./SnippetScreenShell";
import type { ReadoutFeatures, ReadoutPayload, ReadoutSnippet } from "./readout";

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
  const { snippets } = payload;
  const total = snippets.length;
  const [cursor, setCursor] = useState(0);

  const hasSummaryPage = !!(
    onClose && (payload.overallMessage || payload.videoRef)
  );
  const shellTotal = hasSummaryPage
    ? Math.max(total, 1) + 1
    : Math.max(total, 1);
  const idx = Math.min(cursor, Math.max(total - 1, 0));
  const atSummary = hasSummaryPage && cursor === shellTotal - 1;
  const atLast = cursor === shellTotal - 1;
  const isLastSnippet = !hasSummaryPage && atLast;

  if (!onClose) {
    if (total === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-[15px] text-muted-foreground">
            No analyzable snippets in this recording.
          </p>
        </div>
      );
    }
    return (
      <div className="flex flex-1 flex-col">
        <SnippetCard
          snippet={snippets[idx]}
          presentationRef={payload.presentationRef}
          isSample={isSample && idx === 0}
        />
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
    <SnippetScreenShell
      onClose={onClose}
      index={cursor}
      total={shellTotal}
      onPrev={() => setCursor((c) => Math.max(c - 1, 0))}
      onNext={handleNext}
      nextLabel={isLastSnippet && onSend ? "Send for analysis" : undefined}
      nextTone={isLastSnippet && onSend ? "terminal" : "primary"}
      nextDisabled={isLastSnippet && !onSend && total > 0}
      managed={managed}
    >
      {atSummary ? (
        <SummaryPage payload={payload} />
      ) : total === 0 ? (
        <p className="px-4 py-12 text-center text-[15px] text-muted-foreground">
          No analyzable snippets in this recording.
        </p>
      ) : (
        <SnippetCard
          snippet={snippets[idx]}
          presentationRef={payload.presentationRef}
          isSample={isSample && idx === 0}
        />
      )}
    </SnippetScreenShell>
  );
}

/* ── snippet card body ── */

function SnippetCard({
  snippet,
  presentationRef,
  isSample,
}: {
  snippet: ReadoutSnippet;
  presentationRef: string | null;
  isSample: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [breakthroughOpen, setBreakthroughOpen] = useState(false);
  const breakthroughRef = useRef<HTMLDivElement>(null);

  const hasDetails = !!(
    snippet.coach?.note ||
    snippet.coach?.when ||
    (snippet.coach?.examples && snippet.coach.examples.length > 0) ||
    snippet.features
  );
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
    <div className="flex flex-col">
      {/* Slide — edge-to-edge */}
      {snippet.slide ? (
        <div className="w-full bg-muted">
          <SlideRender
            presentationRef={presentationRef}
            pageIndex={snippet.slide.index}
            title={snippet.slide.title}
            body={snippet.slide.body}
            className="w-full"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-4 px-4 py-4">
        {isSample ? (
          <p className="rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-[12px] text-primary">
            Sample data — your real acoustic Training Profile wires in at seam
            ③.
          </p>
        ) : null}

        {/* Audio player */}
        {snippet.audioRef ? (
          <MediaPlayer
            src={snippet.audioRef}
            startOffsetMs={snippet.startOffsetMs}
            durationMs={snippet.durationMs}
          />
        ) : null}

        {/* Transcript — warm-tint, tap to reveal details */}
        {snippet.transcript ? (
          <div
            role={hasDetails ? "button" : undefined}
            tabIndex={hasDetails ? 0 : undefined}
            onClick={hasDetails ? () => setDetailsOpen((v) => !v) : undefined}
            onKeyDown={
              hasDetails
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ")
                      setDetailsOpen((v) => !v);
                  }
                : undefined
            }
            aria-expanded={hasDetails ? detailsOpen : undefined}
            className={`rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3 ${hasDetails ? "cursor-pointer" : ""}`}
          >
            <p className="text-[15px] leading-relaxed text-foreground">
              {snippet.transcript}
            </p>
            {hasCoachNote && !detailsOpen ? (
              <p className="mt-2 text-[12px] font-medium text-primary">
                Tap to see the coach note
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Expanded details: coach note + metrics */}
        {detailsOpen && hasDetails ? (
          <div className="flex flex-col gap-3">
            {snippet.coach?.note ? (
              <p className="text-[15px] leading-relaxed text-foreground">
                {snippet.coach.note}
              </p>
            ) : null}
            {snippet.coach?.when ? (
              <p className="text-[14px] leading-relaxed text-muted-foreground">
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
            {snippet.features ? (
              <MetricsBlock
                features={snippet.features}
                transcript={snippet.transcript}
                durationMs={snippet.durationMs}
              />
            ) : null}
          </div>
        ) : null}

        {/* Breakthrough button */}
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
    </div>
  );
}

/* ── summary page (post-coach, after all snippets) ── */

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

/* ── metrics block (shown when transcript is expanded) ── */

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
