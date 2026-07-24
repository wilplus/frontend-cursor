"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import LoadingState from "./LoadingState";
import MediaPlayer from "@/components/results/MediaPlayer";
import { SlideRender } from "./pdfSlides";
import SnippetScreenShell from "./SnippetScreenShell";
import {
  fetchArcBreakthroughs,
  type ArcBreakthrough,
  type ArcBreakthroughsResult,
} from "@/services/api/bestPresentation";

/* -------------------------------------------------------------------------- */
/*  BreakthroughsOverlay (#5) — every coach-confirmed breakthrough in an arc,  */
/*  newest→oldest, one per screen. Slide on top, the spoken line below, the     */
/*  player clamped to that line, and the coach's "why" note. Mirrors the        */
/*  BestPresentation / readout layout + the per-slide back-dismiss stepping.    */
/* -------------------------------------------------------------------------- */

export default function BreakthroughsOverlay({
  arcId,
  onClose,
}: {
  arcId: string;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [result, setResult] = useState<ArcBreakthroughsResult | null>(null);
  const [cursor, setCursor] = useState(0);

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  // R7 — the shared stack-aware back-dismiss (an inline listener would bypass
  // the overlay stack and cascade-close everything underneath). Back steps one
  // breakthrough back first (onBack consumes), then closes.
  useBackDismiss(onClose, () => {
    if (cursorRef.current > 0) {
      setCursor((c) => c - 1);
      return true;
    }
    return false;
  });

  useEffect(() => {
    let active = true;
    void fetchArcBreakthroughs(arcId).then((r) => {
      if (!active) return;
      setResult(r);
      setStatus(r ? "ready" : "error");
    });
    return () => {
      active = false;
    };
  }, [arcId]);

  // Error is checked BEFORE the `!result` guard: a failed fetch sets
  // status="error" with result=null, so a `!result`-first order would trap it
  // on the spinner forever (matches BestPresentationOverlay's ordering).
  if (status === "error") {
    return (
      <PreShellOverlay onClose={onClose}>
        <p className="text-[15px] text-muted-foreground">
          Couldn&apos;t load your breakthrough moments. Try again in a moment.
        </p>
      </PreShellOverlay>
    );
  }
  if (status === "loading" || !result) {
    return (
      <PreShellOverlay onClose={onClose}>
        <LoadingState />
      </PreShellOverlay>
    );
  }
  if (result.breakthroughs.length === 0) {
    return (
      <PreShellOverlay onClose={onClose}>
        <p className="text-[15px] text-muted-foreground">
          No breakthrough moments yet. They show up here once your coach confirms
          one.
        </p>
      </PreShellOverlay>
    );
  }

  const total = result.breakthroughs.length;
  const atLast = cursor === total - 1;

  return (
    <SnippetScreenShell
      onClose={onClose}
      index={cursor}
      total={total}
      onPrev={() => setCursor((c) => c - 1)}
      onNext={atLast ? onClose : () => setCursor((c) => c + 1)}
      nextLabel={atLast ? "Close" : undefined}
      nextTone={atLast ? "terminal" : "primary"}
      managed={false}
    >
      <BreakthroughCard
        item={result.breakthroughs[cursor]}
        presentationRef={result.presentationRef}
      />
    </SnippetScreenShell>
  );
}

function BreakthroughCard({
  item,
  presentationRef,
}: {
  item: ArcBreakthrough;
  presentationRef: string | null;
}) {
  return (
    <div className="flex flex-col">
      {item.slideIndex !== null ? (
        <div className="w-full bg-muted">
          <SlideRender
            presentationRef={presentationRef}
            pageIndex={item.slideIndex}
            title={item.title}
            body=""
            className="w-full"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="flex items-center gap-1.5 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden />
          <span className="text-[13px] font-semibold">
            Breakthrough{item.takeIndex != null ? ` · take ${item.takeIndex}` : ""}
          </span>
        </div>

        {item.text ? (
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
            {item.text}
          </p>
        ) : null}

        {item.audioRef ? (
          <MediaPlayer
            src={item.audioRef}
            startOffsetMs={item.startOffsetMs}
            durationMs={item.durationMs}
          />
        ) : null}

        {item.note ? (
          <div className="flex flex-col gap-2 rounded-xl bg-primary/[0.08] px-4 py-4">
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
              {item.note}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── minimal fixed overlay for pre-shell states ── */

function PreShellOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 justify-end px-3 pt-3">
        <OverlayCloseButton onClick={onClose} />
      </div>
      <div className="flex flex-1 items-center justify-center px-8 text-center">
        {children}
      </div>
    </div>
  );
}
