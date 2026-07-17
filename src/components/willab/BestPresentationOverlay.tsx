"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, FileDown, Loader2, Sparkles } from "lucide-react";
import OverlayCloseButton from "./OverlayCloseButton";
import LoadingState from "./LoadingState";
import { SlideRender } from "./pdfSlides";
import {
  fetchBestPresentation,
  type BestPresentationResult,
  type BestPresentationSlide,
} from "@/services/api/bestPresentation";
import { unlockArc, ARC_UNLOCK_CREDITS } from "@/services/api/arcUnlock";
import { useUserProfile } from "./useUserProfile";
import { readExploreArc } from "@/lib/willab/exploreArc";
import { useBackDismiss } from "./useBackDismiss";
import CoachIdealTextPanel from "./CoachIdealTextPanel";
import { richMarkersToHtml } from "@/lib/willab/richMarkers";
import { RichText } from "./RichText";

/* -------------------------------------------------------------------------- */
/*  BestPresentationOverlay — the IDEAL TEXT view (Lovable P8).                */
/*                                                                            */
/*  Same scroll skeleton as Recording/Feedback, with the P8 deltas: no          */
/*  playback (text only); font one step bigger; each section under its slide    */
/*  (or the single mock slide); key phrases under each section for glancing     */
/*  while presenting; navbar = counter + Export (print → PDF) + Edit + X;       */
/*  Edit switches the text into a marker editor (bold / italic / underline /    */
/*  orange highlight — the B6 subset, persisted via the existing pencil-edit    */
/*  PUT); read-only by default. Bottom of scroll: "One last step" → /game.      */
/*  (Ticket 1.7's button wins over global decision #2 — flagged.)              */
/* -------------------------------------------------------------------------- */

export default function BestPresentationOverlay({
  arcId,
  onClose,
  onRecordNext,
}: {
  arcId: string;
  onClose: () => void;
  /** P9 — the not-ready progress state gains a start button; the host closes
   *  this overlay and opens the Lab. Receives takesDone so the host can seed
   *  the explore arc THIS overlay shows (not whatever localStorage holds). */
  onRecordNext?: (takesDone: number) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "paywall" | "preparing"
  >("loading");
  const [result, setResult] = useState<BestPresentationResult | null>(null);
  // Bumped after a successful unlock to re-run the fetch (now entitled).
  const [refetchNonce, setRefetchNonce] = useState(0);
  const [unlocking, setUnlocking] = useState(false);
  // Soft, retryable notice under the unlock button — never an error screen.
  const [unlockError, setUnlockError] = useState<string | null>(null);
  // Delivery layer — the coach flow lives in CoachIdealTextPanel now.
  const { isCoach } = useUserProfile();

  // R7 — the shared stack-aware back-dismiss (an inline popstate listener would
  // bypass the overlay stack and cascade-close everything underneath). The
  // returned suppressor replaces the old leftViaNavRef: call it right before a
  // FORWARD navigation (pricing top-up, the game link) so the unmount cleanup
  // doesn't history.back() over it.
  const suppressBackDismiss = useBackDismiss(onClose);

  async function handleUnlock() {
    if (unlocking) return;
    setUnlockError(null);
    setUnlocking(true);
    const r = await unlockArc(arcId);
    setUnlocking(false);
    if (r.ok) {
      setStatus("loading");
      setRefetchNonce((n) => n + 1);
      return;
    }
    if (r.reason === "insufficient") {
      suppressBackDismiss();
      router.push("/dashboard/pricing");
      return;
    }
    setUnlockError(r.message);
  }

  useEffect(() => {
    let active = true;
    void fetchBestPresentation(arcId).then((r) => {
      if (!active) return;
      if (r && "paymentRequired" in r) {
        setStatus("paywall");
        return;
      }
      if (r && "preparing" in r) {
        setStatus("preparing");
        return;
      }
      setResult(r);
      setStatus(r ? "ready" : "error");
    });
    return () => {
      active = false;
    };
  }, [arcId, refetchNonce]);

  // ── "2/12" — scroll-following section counter (same pattern as the readout).
  const [current, setCurrent] = useState(0);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const sectionNodes = useRef<(HTMLElement | null)[]>([]);
  const slideCount = result?.slides.length ?? 0;
  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const idx = sectionNodes.current.indexOf(e.target as HTMLElement);
          if (idx >= 0) setCurrent(idx);
        }
      },
      { root, rootMargin: "-30% 0px -65% 0px", threshold: 0 }
    );
    sectionNodes.current
      .filter((n): n is HTMLElement => n !== null)
      .forEach((n) => io.observe(n));
    const onScroll = () => {
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
        setCurrent(Math.max(slideCount - 1, 0));
      }
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      root.removeEventListener("scroll", onScroll);
    };
  }, [slideCount, status]);

  // ── Export: a print window (browser Save as PDF) preserving the marker
  // formatting + key phrases + game deep links. Client-side, zero deps.
  function handleExport() {
    if (!result) return;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return; // popup blocked — nothing to break
    const esc = (t: string) =>
      t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sectionsHtml = result.slides
      .map((s) => {
        const phrases = s.keyPhrases.length
          ? `<p style="margin:6px 0 0;color:#666;font-size:12px">${s.keyPhrases
              .map(esc)
              .join(" · ")}</p>`
          : "";
        // SD — the game deep-link is retired; the export marks the moment only.
        const key = s.breakthrough
          ? `<p style="margin:6px 0 0;color:#ee7a2b;font-weight:600">Key moment</p>`
          : "";
        return `<section style="margin:0 0 22px">
          ${s.title ? `<h2 style="font-size:14px;margin:0 0 6px;color:#999;font-weight:600">${esc(s.title)}</h2>` : ""}
          <p style="font-size:16px;line-height:1.6;margin:0">${richMarkersToHtml(s.text)}</p>
          ${phrases}${key}
        </section>`;
      })
      .join("");
    w.document.write(`<!doctype html><html><head><title>${esc(
      result.name ?? "Ideal Text"
    )}</title></head><body style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:32px auto;padding:0 20px;color:#111">
      <h1 style="font-size:20px;margin:0 0 20px">${esc(result.name ?? "Ideal Text")}</h1>
      ${sectionsHtml}
      <script>window.onload = function () { window.print(); };</script>
    </body></html>`);
    w.document.close();
  }

  // Founder redesign — for the COACH the ideal-text editor IS the whole view:
  // a slide + the text below in editable paragraphs, minimalistic (no student
  // sections, no paywall/preparing/error student screens). The panel fetches
  // the coach lane itself and renders its own pending/empty/ready/failed. The
  // deck ref rides along from the student fetch when it happens to be resolved;
  // otherwise the panel falls back to the ref the coach lane echoes.
  if (isCoach) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-background">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/70 px-4 py-2.5 backdrop-blur">
          <span className="text-[13px] font-medium text-foreground">
            Ideal text · coach review
          </span>
          <OverlayCloseButton onClick={onClose} />
        </div>
        <CoachIdealTextPanel
          arcId={arcId}
          presentationRef={result?.presentationRef ?? null}
        />
      </div>
    );
  }

  if (status === "paywall") {
    return (
      <PreShellOverlay onClose={onClose}>
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <Crown className="h-6 w-6 text-amber-500" aria-hidden />
          <p className="text-[15px] font-semibold text-foreground">
            This is part of the full audit
          </p>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Unlock it for ${ARC_UNLOCK_CREDITS}: your coach-corrected ideal text,
            every breakthrough moment, and more. Money-back guaranteed.
          </p>
          <button
            type="button"
            onClick={() => void handleUnlock()}
            disabled={unlocking}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {unlocking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Unlocking...
              </>
            ) : (
              `Unlock for ${ARC_UNLOCK_CREDITS} credits`
            )}
          </button>
          {unlockError ? (
            <p className="text-[13px] text-muted-foreground">{unlockError}</p>
          ) : null}
        </div>
      </PreShellOverlay>
    );
  }
  if (status === "preparing") {
    return (
      <PreShellOverlay onClose={onClose}>
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <Crown className="h-6 w-6 text-amber-500" aria-hidden />
          <p className="text-[15px] font-semibold text-foreground">
            Your coach is putting this together
          </p>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Your ideal text is being prepared by your coach. We&apos;ll let you
            know the moment it&apos;s ready.
          </p>
        </div>
      </PreShellOverlay>
    );
  }
  if (status === "error") {
    // FE-1 — never a dead-end: the load can fail transiently (the presentation
    // is still coming together, or a network blip), so offer a retry, plus a
    // forward path to record the next take so the user is never stuck here.
    // takesDone is derived from the cached arc (nextTakeIndex - 1) since there's
    // no fetched result to read it from; the host ignores it when localStorage
    // already holds this arc.
    return (
      <PreShellOverlay onClose={onClose}>
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="max-w-sm text-[15px] text-muted-foreground">
            We couldn&apos;t load your presentation just now. It may still be
            coming together.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStatus("loading");
                setRefetchNonce((n) => n + 1);
              }}
              className="rounded-full bg-foreground px-6 py-2.5 text-[14px] font-medium text-background transition hover:bg-foreground/90"
            >
              Try again
            </button>
            {onRecordNext ? (
              <button
                type="button"
                onClick={() => {
                  // Only trust the cached take counter when it belongs to THIS
                  // arc; otherwise (a different arc, or evicted) pass 0 so the
                  // host doesn't seed a take number from an unrelated arc. The
                  // BE reconciles the real take_index on the POST regardless.
                  const cached = readExploreArc();
                  const takesDone =
                    cached?.arcId === arcId
                      ? Math.max(0, cached.nextTakeIndex - 1)
                      : 0;
                  onRecordNext(takesDone);
                }}
                className="rounded-full border border-border px-6 py-2.5 text-[14px] font-medium text-foreground transition hover:bg-muted"
              >
                Record the next take
              </button>
            ) : null}
          </div>
        </div>
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
  if (!result.ready) {
    return (
      <PreShellOverlay onClose={onClose}>
        <NotReadyState
          progress={result.progress}
          onRecordNext={
            onRecordNext
              ? () => onRecordNext(result.progress.takesDone)
              : undefined
          }
        />
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

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Shaded top navbar: counter · Export · Edit · X (P8). */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/70 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] font-medium tabular-nums text-foreground">
          {Math.min(current + 1, result.slides.length)}/{result.slides.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            aria-label="Export to PDF"
            className="flex h-[28px] items-center gap-1.5 rounded-full border border-border px-3 text-[12px] font-medium text-foreground"
          >
            <FileDown className="h-[14px] w-[14px]" aria-hidden />
            Export
          </button>
          <OverlayCloseButton onClick={onClose} />
        </div>
      </div>

      <div ref={scrollRootRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl">
          {/* Name header (crown identity). */}
          {result.name ? (
            <div className="flex items-center gap-2 px-4 pt-4">
              <Crown className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
              <h2 className="text-[17px] font-semibold leading-snug text-foreground">
                {result.name}
              </h2>
            </div>
          ) : null}
          {!result.coachReviewed ? (
            <span className="ml-4 mt-2 inline-block rounded-full bg-muted px-2.5 py-1 text-[12px] font-medium text-muted-foreground">
              Draft, pending coach review
            </span>
          ) : null}

          {result.slides.map((slide, i) => (
            <IdealTextSection
              key={slide.index}
              refCallback={(el) => {
                sectionNodes.current[i] = el;
              }}
              slide={slide}
              presentationRef={result.presentationRef}
            />
          ))}

          {/* SD — the game CTA is retired from the student surface: the ideal
              text IS the product's end, nothing after it. */}
          <div className="pb-10" />
        </div>
      </div>
    </div>
  );
}

/* ── one ideal-text section: slide image → text (font +1) → key phrases ── */

function IdealTextSection({
  refCallback,
  slide,
  presentationRef,
}: {
  refCallback: (el: HTMLElement | null) => void;
  slide: BestPresentationSlide;
  presentationRef: string | null;
}) {
  const hasSlideVisual = !!presentationRef || !!slide.title;
  return (
    <section ref={refCallback} className="flex flex-col">
      {hasSlideVisual ? (
        <div className="mt-4 w-full bg-muted">
          <SlideRender
            presentationRef={presentationRef}
            pageIndex={slide.index}
            title={slide.title}
            body=""
            className="w-full"
          />
        </div>
      ) : (
        <PlaceholderSlide />
      )}

      <div className="flex flex-col gap-3 px-4 py-4">
        {slide.text ? (
          // Read view: font one step bigger than the readout (16 vs 15).
          // Delivery layer: read-only — per-slide editing retired (the coach
          // edits the ONE-BLOCK ideal text; the user edits their notebook copy).
          <p className="whitespace-pre-line text-[16px] leading-relaxed text-foreground">
            {/* FE-9 — the shared marker renderer, identical to the coach
                preview and the notebook. */}
            <RichText text={slide.text} />
          </p>
        ) : (
          <p className="text-[14px] italic text-muted-foreground">
            No best recording for this slide yet.
          </p>
        )}

        {/* Key phrases — the glance layer while presenting (P8/B5). */}
        {slide.keyPhrases.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {slide.keyPhrases.map((k, i) => (
              <span
                key={i}
                className="rounded-full bg-primary/10 px-2.5 py-1 text-[12px] font-medium text-primary"
              >
                {k}
              </span>
            ))}
          </div>
        ) : null}

        {slide.breakthrough ? (
          <p className="text-[13px] font-medium text-primary">
            <Sparkles className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Key moment{slide.breakthroughNote ? `: ${slide.breakthroughNote}` : ""}
          </p>
        ) : null}

        {slide.text ? (
          <p className="text-[11px] text-muted-foreground">
            from your take {slide.takeIndex}
            {slide.edited ? ", edited" : ""}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/* ── deckless mock slide ── */

function PlaceholderSlide() {
  return (
    <div className="mt-4 flex aspect-video w-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
      <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
        <Sparkles className="h-8 w-8" aria-hidden />
        <p className="text-[12px] font-medium uppercase tracking-wider">
          Audio only
        </p>
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

/* ── not-ready state ── */

function NotReadyState({
  progress,
  onRecordNext,
}: {
  progress: { takesDone: number; takesTarget: number; takesRemaining: number };
  onRecordNext?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* #6 — the canonical counter copy, same as the progress card. */}
      <p className="text-[15px] text-foreground">
        To complete the full training you need {progress.takesRemaining} more{" "}
        {progress.takesRemaining === 1 ? "take" : "takes"}
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
          aria-label="Progress to the full training"
        />
      </div>
      {/* P9 — the missing start button on the progress interstitial. */}
      {onRecordNext ? (
        <button
          type="button"
          onClick={onRecordNext}
          className="mt-1 rounded-full bg-foreground px-6 py-2.5 text-[14px] font-medium text-background transition hover:bg-foreground/90"
        >
          Record the next take
        </button>
      ) : null}
    </div>
  );
}
