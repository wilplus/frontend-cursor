"use client";

import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { uiText } from "@/lib/uiLocale";

/* -------------------------------------------------------------------------- */
/*  LoadingState — the one generic full-surface waiting composition            */
/*                                                                            */
/*  Every page wait uses the same circular three-dot bubble. The shell owns    */
/*  the footprint and centering; the bubble never changes size or position     */
/*  when a route, phase or data source changes. In-conversation response dots  */
/*  intentionally remain in TypingDots.                                      */
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
      data-viewport-wait={placement === "viewport" ? "" : undefined}
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

/** The shared circular three-dot loader. Opacity changes only; the dots never
 *  jump, so the footprint stays calm at every size. */
export function LoadingBubble({ size = 64, className }: { size?: number; className?: string }) {
  const dotSize = Math.max(2, Math.round(size * 0.1));
  const gap = Math.max(2, Math.round(size * 0.06));
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-muted${className ? ` ${className}` : ""}`}
      style={{ height: size, width: size, gap }}
      aria-hidden="true"
      data-loading-bubble=""
    >
      {["-0.24s", "-0.12s", "0s"].map((delay) => (
        <span
          key={delay}
          className="loading-dot rounded-full bg-muted-foreground/60"
          style={{ height: dotSize, width: dotSize, animationDelay: delay }}
          data-loading-dot=""
        />
      ))}
    </span>
  );
}

/** Compatibility name for compact action states. It uses the same bubble as
 *  every full-surface wait, only scaled to the control that owns it. */
export function VoiceMark({ size, className }: { size: number; className?: string }) {
  return <LoadingBubble size={size} className={className} />;
}

export default function LoadingState({
  placement,
  kind = "generic",
  label,
  labelVisible = false,
  note = null,
}: {
  /** Viewport owns the screen; surface fills its already-mounted parent. */
  readonly placement: "viewport" | "surface";
  readonly kind?: LoadingSurfaceKind;
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
      <div data-loading-indicator>
        <LoadingBubble />
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
    <LoadingSurface placement={placement} kind={kind}>
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
        <div data-loading-indicator>
          <LoadingBubble />
        </div>
        <span className="sr-only" role="status">
          {resolvedLabel}
        </span>
      </div>
    </LoadingSurface>
  );
}
