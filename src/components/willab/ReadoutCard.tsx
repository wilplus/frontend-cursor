"use client";

import { useState } from "react";
import { SlideRender } from "./pdfSlides";
import SnippetReadoutBlock from "./SnippetReadoutBlock";
import SnippetScreenShell from "./SnippetScreenShell";
import type { ReadoutPayload, ReadoutSnippet } from "./readout";

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

  const idx = Math.min(cursor, Math.max(total - 1, 0));
  const atLast = total === 0 || idx === total - 1;

  if (!onClose) {
    // Legacy embedded mode — used when the parent overlay owns the chrome.
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
          overallMessage={idx === 0 ? (payload.overallMessage ?? null) : null}
        />
      </div>
    );
  }

  // Shell mode: SnippetScreenShell wraps each snippet as a page.
  const shellTotal = Math.max(total, 1);

  function handleNext() {
    if (atLast) {
      if (onSend) onSend();
    } else {
      setCursor((c) => c + 1);
    }
  }

  return (
    <SnippetScreenShell
      onClose={onClose}
      index={idx}
      total={shellTotal}
      onPrev={() => setCursor((c) => Math.max(c - 1, 0))}
      onNext={handleNext}
      nextLabel={atLast && onSend ? "Send for analysis" : undefined}
      nextTone={atLast && onSend ? "terminal" : "primary"}
      nextDisabled={atLast && !onSend && total > 0}
      managed={managed}
    >
      {total === 0 ? (
        <p className="py-12 text-center text-[15px] text-muted-foreground">
          No analyzable snippets in this recording.
        </p>
      ) : (
        <SnippetCard
          snippet={snippets[idx]}
          presentationRef={payload.presentationRef}
          isSample={isSample && idx === 0}
          overallMessage={idx === 0 ? (payload.overallMessage ?? null) : null}
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
  overallMessage,
}: {
  snippet: ReadoutSnippet;
  presentationRef: string | null;
  isSample: boolean;
  overallMessage: string | null;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4">
      {isSample ? (
        <p className="rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-[12px] text-primary">
          Sample data — your real acoustic Training Profile wires in at seam ③.
        </p>
      ) : null}

      {overallMessage ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
            From your coach
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-foreground">
            {overallMessage}
          </p>
        </div>
      ) : null}

      {snippet.slide ? (
        <SlideRender
          presentationRef={presentationRef}
          pageIndex={snippet.slide.index}
          title={snippet.slide.title}
          body={snippet.slide.body}
          className="w-full"
        />
      ) : null}

      <SnippetReadoutBlock
        audioRef={snippet.audioRef}
        startOffsetMs={snippet.startOffsetMs}
        durationMs={snippet.durationMs}
        transcript={snippet.transcript}
        stickiness={snippet.stickiness}
        features={snippet.features}
      />

      {snippet.coach ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-primary">
              Your coach
            </span>
            {snippet.coach.tag ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                {snippet.coach.tag === "strong" ? "Strong" : "To work on"}
              </span>
            ) : null}
          </div>
          {snippet.coach.note ? (
            <p className="mt-1 text-[15px] leading-relaxed text-foreground">
              {snippet.coach.note}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
