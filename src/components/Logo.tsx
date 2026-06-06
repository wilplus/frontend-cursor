import { cn } from "@/lib/utils";

/**
 * WillpowerLab logo — three black dots in voice/EQ rhythm + wordmark.
 *
 * Visual:
 *   ●   ●   ●     (middle dot is slightly larger)
 *   WillpowerLab
 *
 * The dots are an intentional metaphor for spoken rhythm — the
 * middle dot's emphasis reads as the "beat" of a syllable, the
 * outer dots as its surround. In the `animated` state each dot
 * scales on a staggered `voice-dot` keyframe so the mark reads as
 * "actively listening" rather than a static icon. Use `animated`
 * only when the product is literally capturing voice (recording,
 * speech input), never as decorative motion — that would dilute
 * the signal-only role of orange (the mark itself stays black; the
 * dots scale, they don't change color).
 *
 * Reduced-motion users automatically get the static form via the
 * `prefers-reduced-motion` override in globals.css.
 *
 * `size` is kept as an escape hatch for the auth pages (sign-up,
 * login, etc.) where the mark is centered on a near-empty surface
 * and the in-app default reads too small. In-app surfaces (Lounge
 * header, completion screen) should leave `size` at default.
 */
export default function Logo({
  className,
  size = "md",
  animated = false,
}: {
  className?: string;
  /** sm = compact (auth bar). md = default (Lounge header, completion).
   *  lg = full-bleed centered (auth-page hero). */
  size?: "sm" | "md" | "lg";
  /** When true, dots scale on a staggered voice-dot cycle.
   *  Reserve for moments where the product is literally listening. */
  animated?: boolean;
}) {
  // Visual ratios: dot SVG height stays the brand mark; wordmark
  // text scales with size. The middle dot's radius (3.2) is set
  // larger than the outer dots (2.2) so the mark reads as a
  // weighted beat, not a uniform row.
  const svgPx = size === "lg" ? 30 : size === "sm" ? 18 : 22;
  const wordmarkClass =
    size === "lg"
      ? "text-2xl"
      : size === "sm"
      ? "text-[13px]"
      : "text-[15px]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-foreground",
        className
      )}
      aria-label="WillpowerLab"
    >
      <svg
        width={svgPx}
        height={svgPx}
        viewBox="0 0 22 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle
          cx="3"
          cy="11"
          r="2.2"
          fill="currentColor"
          className={animated ? "animate-voice-dot" : undefined}
          style={animated ? { animationDelay: "0ms" } : undefined}
        />
        <circle
          cx="11"
          cy="11"
          r="3.2"
          fill="currentColor"
          className={animated ? "animate-voice-dot" : undefined}
          style={animated ? { animationDelay: "150ms" } : undefined}
        />
        <circle
          cx="19"
          cy="11"
          r="2.2"
          fill="currentColor"
          className={animated ? "animate-voice-dot" : undefined}
          style={animated ? { animationDelay: "300ms" } : undefined}
        />
      </svg>
      <span
        className={cn("font-semibold tracking-tight", wordmarkClass)}
      >
        WillpowerLab
      </span>
    </span>
  );
}
