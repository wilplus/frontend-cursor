"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Sparkles } from "lucide-react";
import OverlayCloseButton from "./OverlayCloseButton";
import LoadingState from "./LoadingState";
import MediaPlayer from "@/components/results/MediaPlayer";
import { SlideRender } from "./pdfSlides";
import SnippetScreenShell from "./SnippetScreenShell";
import {
  fetchArcBreakthroughs,
  type ArcBreakthrough,
  type ArcBreakthroughsResult,
} from "@/services/api/bestPresentation";
import { unlockArc, ARC_UNLOCK_CREDITS } from "@/services/api/arcUnlock";

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
  const router = useRouter();
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "paywall"
  >("loading");
  const [result, setResult] = useState<ArcBreakthroughsResult | null>(null);
  const [cursor, setCursor] = useState(0);
  // Bumped after a successful unlock to re-run the fetch (now entitled).
  const [refetchNonce, setRefetchNonce] = useState(0);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  // True when the user leaves via the pricing top-up (insufficient credits). The
  // cleanup must NOT balance the history entry then, or the queued back() pops
  // the freshly pushed route and bounces the user off pricing (the #169 bug).
  const leftViaNavRef = useRef(false);

  // Spend credits to unlock this arc — mirrors BestPresentationOverlay. A paywall
  // is never an error: on success refetch; short on credits → pricing top-up;
  // transient / not-built (404) → a soft retry notice, never a silent dead-tap.
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
      leftViaNavRef.current = true;
      router.push("/dashboard/pricing");
      return;
    }
    setUnlockError(r.message);
  }

  // Back-dismiss with per-item stepping (same pattern as BestPresentationOverlay).
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
      if (!closedByPopstate && !leftViaNavRef.current) window.history.back();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchArcBreakthroughs(arcId).then((r) => {
      if (!active) return;
      // 402 = paid-but-unpurchased deliverable → a clean paywall, never an error.
      if (r && "paymentRequired" in r) {
        setStatus("paywall");
        return;
      }
      setResult(r);
      setStatus(r ? "ready" : "error");
    });
    return () => {
      active = false;
    };
  }, [arcId, refetchNonce]);

  if (status === "paywall") {
    return (
      <PreShellOverlay onClose={onClose}>
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <Crown className="h-6 w-6 text-amber-500" aria-hidden />
          <p className="text-[15px] font-semibold text-foreground">
            This is part of the full audit
          </p>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Unlock it for ${ARC_UNLOCK_CREDITS}: every breakthrough moment across
            your takes, your coach-corrected ideal text, and more. Money-back
            guaranteed.
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
  if (status === "loading" || !result) {
    return (
      <PreShellOverlay onClose={onClose}>
        <LoadingState />
      </PreShellOverlay>
    );
  }
  if (status === "error") {
    return (
      <PreShellOverlay onClose={onClose}>
        <p className="text-[15px] text-muted-foreground">
          Couldn&apos;t load your breakthrough moments. Try again in a moment.
        </p>
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
