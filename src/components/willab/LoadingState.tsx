"use client";

import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { uiText } from "@/lib/uiLocale";

/* -------------------------------------------------------------------------- */
/*  LoadingState — the one generic full-surface waiting composition            */
/*                                                                            */
/*  Generic waits know only that work is happening. They therefore render the  */
/*  canonical 64px voice mark and an assistive label—no stage, fake percentage, */
/*  progress rail, or recommendation. Post-recording analysis owns those richer */
/*  elements exclusively in RecordingAnalysisPresentation.                     */
/* -------------------------------------------------------------------------- */

export type LoadingPlacement = "viewport" | "surface";
export type LoadingSurfaceKind = "generic" | "processing";

/**
 * Every full-surface wait goes through this frame. The outer surface owns the
 * lifecycle's footprint; the inner frame owns centering. Keeping those two
 * boxes present across label, phase and progress changes prevents the mark
 * from inheriting a screen-specific flex alignment or a changing content
 * height. Inline chat/lens waits intentionally do not use this component.
 */
export function LoadingSurface({
  placement,
  kind = "generic",
  className,
  children,
}: {
  readonly placement: LoadingPlacement;
  readonly kind?: LoadingSurfaceKind;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  const rootClass =
    placement === "viewport"
      ? "fixed inset-0 z-40 flex bg-background px-6"
      : "flex min-h-0 min-h-full w-full flex-1 self-stretch bg-background px-6";

  return (
    <div
      data-loading-surface={kind}
      data-loading-placement={placement}
      className={`${rootClass}${className ? ` ${className}` : ""}`}
    >
      <div
        data-loading-frame
        className="flex min-h-0 min-h-full w-full flex-1 items-center justify-center"
      >
        {children}
      </div>
    </div>
  );
}

/** The breathing voice mark. LoadingState fixes it at 64px; this primitive is
 *  exported only for deliberately compact, in-control status treatments. */
export function VoiceMark({ size, className }: { size: number; className?: string }) {
  return (
    <span
      className={`relative flex items-center justify-center${className ? ` ${className}` : ""}`}
      style={{ height: size, width: size }}
      aria-hidden="true"
      data-voice-mark=""
    >
      <span className="breath-ring absolute inset-0 rounded-full border border-foreground/10" />
      <span
        className="breath-ring absolute rounded-full border border-foreground/15"
        style={{ inset: Math.max(1, Math.round(size * 0.094)), animationDelay: "0.6s" }}
      />
      <span
        className="breath-ring absolute rounded-full border border-primary/30"
        style={{ inset: Math.max(2, Math.round(size * 0.1875)), animationDelay: "1.2s" }}
      />
      <svg
        width={Math.round(size * 0.42)}
        height={Math.round(size * 0.42)}
        viewBox="0 0 56 56"
        aria-hidden="true"
      >
        <circle
          className="welcome-voice-dot"
          cx="12"
          cy="28"
          r="4"
          fill="hsl(var(--foreground))"
        />
        <circle
          className="welcome-voice-dot"
          cx="28"
          cy="28"
          r="6"
          fill="hsl(var(--foreground))"
        />
        <circle
          className="welcome-voice-dot"
          cx="44"
          cy="28"
          r="4"
          fill="hsl(var(--foreground))"
        />
      </svg>
    </span>
  );
}

export default function LoadingState({
  placement,
  label,
  labelVisible = false,
  note = null,
}: {
  /** Viewport owns the screen; surface fills its already-mounted parent. */
  readonly placement: "viewport" | "surface";
  readonly label?: string;
  /** The label as small grey text 16px under the mark, as the recording
   *  prototype's renderMic draws "Getting your mic ready" (founder lock
   *  2026-10-07; Q-B4 A signed the prototype's words, N63). Only the
   *  recording's mic wait sets this; every other wait keeps the label for
   *  screen readers alone. */
  readonly labelVisible?: boolean;
  /** More lines under a visible label, in the same small grey: before a
   *  later Take, which presentation it is said against (presentationInPlay),
   *  and the earbuds line (N372). */
  readonly note?: string | readonly string[] | null;
}) {
  const locale = useUiLocale();
  const resolvedLabel = label ?? uiText(locale, "loading");
  const presentation = (
    <div
      data-loading-content
      className="flex w-full flex-col items-center justify-center"
    >
      <div data-loading-indicator className="flex h-16 w-16 shrink-0 items-center justify-center">
        <VoiceMark size={64} />
      </div>
      {labelVisible ? (
        <>
          <p role="status" data-loading-label className="mt-4 text-[15px] text-muted-foreground">
            {resolvedLabel}
          </p>
          {(typeof note === "string" ? [note] : note ?? []).map((line) => (
            <p key={line} data-loading-note className="mt-1 text-[13px] text-muted-foreground">
              {line}
            </p>
          ))}
        </>
      ) : (
        <span className="sr-only" role="status">
          {resolvedLabel}
        </span>
      )}
    </div>
  );

  return (
    <LoadingSurface placement={placement}>
      {presentation}
    </LoadingSurface>
  );
}

/** Content-region wait: same canonical mark size, without taking the viewport. */
export function SectionLoadingState({ label }: { label?: string }) {
  const locale = useUiLocale();
  const resolvedLabel = label ?? uiText(locale, "loading");
  return (
    <LoadingSurface placement="surface" className="min-h-[140px]">
      <div data-loading-content className="flex flex-col items-center justify-center">
        <div data-loading-indicator className="flex h-16 w-16 shrink-0 items-center justify-center">
          <VoiceMark size={64} />
        </div>
        <span className="sr-only" role="status">
          {resolvedLabel}
        </span>
      </div>
    </LoadingSurface>
  );
}
