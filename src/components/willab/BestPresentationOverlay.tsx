"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Pencil, X } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import { SlideRender } from "./pdfSlides";
import SnippetScreenShell from "./SnippetScreenShell";
import {
  fetchBestPresentation,
  saveBestPresentationSlideText,
  type BestPresentationResult,
  type BestPresentationSlide,
} from "@/services/api/bestPresentation";

export default function BestPresentationOverlay({
  arcId,
  onClose,
}: {
  arcId: string;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [result, setResult] = useState<BestPresentationResult | null>(null);
  const [cursor, setCursor] = useState(0);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  // Back-dismiss with per-slide stepping: swipe-back on slide N goes to N-1;
  // swipe-back on slide 0 closes the overlay. A fresh entry is pushed after
  // each internal step so the next swipe is still catchable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let closedByPopstate = false;
    window.history.pushState({ __willabOverlay: true }, "");
    function handlePop() {
      if (cursorRef.current > 0) {
        setCursor((c) => c - 1);
        window.history.pushState({ __willabOverlay: true }, "");
      } else {
        closedByPopstate = true;
        onCloseRef.current();
      }
    }
    window.addEventListener("popstate", handlePop);
    return () => {
      window.removeEventListener("popstate", handlePop);
      // Only balance our entry on a non-Back close; a Back already popped it,
      // and a second back() would walk past /chat to /login.
      if (!closedByPopstate) window.history.back();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchBestPresentation(arcId).then((r) => {
      if (!active) return;
      setResult(r);
      setStatus(r ? "ready" : "error");
    });
    return () => {
      active = false;
    };
  }, [arcId]);

  if (status === "loading" || !result) {
    return (
      <PreShellOverlay onClose={onClose}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </PreShellOverlay>
    );
  }
  if (status === "error") {
    return (
      <PreShellOverlay onClose={onClose}>
        <p className="text-[15px] text-muted-foreground">
          Couldn&apos;t load your presentation. Try again in a moment.
        </p>
      </PreShellOverlay>
    );
  }
  if (!result.ready) {
    return (
      <PreShellOverlay onClose={onClose}>
        <NotReadyState progress={result.progress} />
      </PreShellOverlay>
    );
  }
  if (result.slides.length === 0) {
    return (
      <PreShellOverlay onClose={onClose}>
        <p className="text-[15px] text-muted-foreground">
          No slide data found for this presentation.
        </p>
      </PreShellOverlay>
    );
  }

  const total = result.slides.length;
  const atLast = cursor === total - 1;

  function handleTextSaved(slideIndex: number, newText: string) {
    setResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        slides: prev.slides.map((s) =>
          s.index === slideIndex ? { ...s, text: newText } : s
        ),
      };
    });
  }

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
      <SlideCard
        slide={result.slides[cursor]}
        presentationRef={result.presentationRef}
        arcId={arcId}
        onTextSaved={handleTextSaved}
      />
    </SnippetScreenShell>
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-border text-muted-foreground"
        >
          <X className="h-[17px] w-[17px]" aria-hidden />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center px-8 text-center">
        {children}
      </div>
    </div>
  );
}

/* ── not-ready state ── */

function NotReadyState({
  progress,
}: {
  progress: { takesDone: number; takesTarget: number; takesRemaining: number };
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-[15px] text-foreground">
        Your best presentation needs {progress.takesRemaining} more{" "}
        {progress.takesRemaining === 1 ? "take" : "takes"} — minimum 3.
      </p>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width: `${Math.round(
              (progress.takesDone / progress.takesTarget) * 100
            )}%`,
          }}
          role="progressbar"
          aria-valuenow={progress.takesDone}
          aria-valuemin={0}
          aria-valuemax={progress.takesTarget}
          aria-label="Sessions complete"
        />
      </div>
      <p className="text-[12px] text-muted-foreground">
        {progress.takesDone} of {progress.takesTarget} sessions complete
      </p>
    </div>
  );
}

/* ── per-slide card body ── */

function SlideCard({
  slide,
  presentationRef,
  arcId,
  onTextSaved,
}: {
  slide: BestPresentationSlide;
  presentationRef: string | null;
  arcId: string;
  onTextSaved: (slideIndex: number, text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(slide.text);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hasContent = slide.text.length > 0 || slide.audioRef !== null;

  function startEdit() {
    setDraftText(slide.text);
    setEditing(true);
    setSaveError(null);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError(null);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    const result = await saveBestPresentationSlideText(
      arcId,
      slide.index,
      draftText
    );
    setSaving(false);
    if (result.ok) {
      onTextSaved(slide.index, draftText);
      setEditing(false);
    } else {
      setSaveError(result.message ?? "Could not save. Try again.");
    }
  }

  return (
    <div className="flex flex-col">
      {/* Slide — edge-to-edge, pencil overlaid at bottom-left */}
      <div className="relative">
        <div className="w-full bg-muted">
          <SlideRender
            presentationRef={presentationRef}
            pageIndex={slide.index}
            title={slide.title}
            body=""
            className="w-full"
          />
        </div>
        <button
          type="button"
          onClick={startEdit}
          aria-label="Edit composed text"
          className="absolute bottom-2 left-3 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
        >
          <Pencil className="h-[13px] w-[13px]" aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Composed text — warm-tint; pencil (on the slide) enters edit mode,
            the chevron expands the player + breakthrough in place */}
        {hasContent ? (
          <>
            {editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-primary bg-background px-3 py-2 text-[15px] leading-relaxed outline-none focus:ring-1 focus:ring-primary"
                />
                {saveError ? (
                  <p className="text-[13px] text-destructive">{saveError}</p>
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={saving}
                    className="flex-1 rounded-full border border-border py-2 text-[14px] text-foreground disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="flex-1 rounded-full bg-primary py-2 text-[14px] font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : slide.text ? (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailsOpen((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      setDetailsOpen((v) => !v);
                  }}
                  aria-expanded={detailsOpen}
                  className="flex items-start gap-3 cursor-pointer rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3"
                >
                  <p className="flex-1 text-[15px] leading-relaxed text-foreground">
                    {slide.text}
                  </p>
                  <ChevronDown
                    className={`mt-0.5 h-5 w-5 shrink-0 text-primary transition-transform ${detailsOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </div>

                {/* Expanded, in place: player → breakthrough */}
                {detailsOpen ? (
                  <div className="flex flex-col gap-4">
                    {slide.audioRef ? (
                      <MediaPlayer
                        src={slide.audioRef}
                        startOffsetMs={0}
                        durationMs={0}
                      />
                    ) : null}
                    {slide.breakthrough ? (
                      <div className="flex flex-col gap-2 rounded-xl bg-primary/[0.08] px-4 py-4">
                        <p className="text-[15px] font-semibold text-foreground">
                          🥳 Here you turned your stress into charisma!
                        </p>
                        {slide.breakthroughNote ? (
                          <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
                            {slide.breakthroughNote}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-[14px] italic text-muted-foreground">
                No best recording for this slide yet.
              </p>
            )}

            {/* Provenance */}
            {!editing ? (
              <p className="text-[11px] text-muted-foreground">
                from your take {slide.takeIndex}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[14px] italic text-muted-foreground">
            No best recording for this slide yet.
          </p>
        )}

      </div>
    </div>
  );
}
