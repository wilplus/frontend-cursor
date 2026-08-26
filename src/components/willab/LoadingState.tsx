"use client";

/* -------------------------------------------------------------------------- */
/*  LoadingState — the one generic full-surface waiting composition            */
/*                                                                            */
/*  Generic waits know only that work is happening. They therefore render the  */
/*  canonical 64px voice mark and an assistive label—no stage, fake percentage, */
/*  progress rail, or recommendation. Post-recording analysis owns those richer */
/*  elements exclusively in RecordingAnalysisPresentation.                     */
/* -------------------------------------------------------------------------- */

/** The breathing voice mark. LoadingState fixes it at 64px; this primitive is
 *  exported only for deliberately compact, in-control status treatments. */
export function VoiceMark({ size }: { size: number }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ height: size, width: size }}
      aria-hidden="true"
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
    </div>
  );
}

export default function LoadingState({
  placement,
  label = "Loading",
}: {
  /** Viewport owns the screen; surface fills its already-mounted parent. */
  readonly placement: "viewport" | "surface";
  readonly label?: string;
}) {
  const presentation = (
    <div className="flex min-h-full w-full flex-1 items-center justify-center">
      <VoiceMark size={64} />
      <span className="sr-only" role="status">
        {label}
      </span>
    </div>
  );

  if (placement === "viewport") {
    return (
      <div className="fixed inset-0 z-40 flex justify-center bg-background px-6">
        {presentation}
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full flex-1 self-stretch justify-center bg-background px-6">
      {presentation}
    </div>
  );
}

/** Content-region wait: same canonical mark size, without taking the viewport. */
export function SectionLoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[140px] flex-1 items-center justify-center">
      <VoiceMark size={64} />
      <span className="sr-only" role="status">
        {label}
      </span>
    </div>
  );
}
