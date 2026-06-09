"use client";

import { useState } from "react";

/* -------------------------------------------------------------------------- */
/*  WelcomeConsent — first-run screen (§12), rebuilt to the Welcome spec        */
/*                                                                            */
/*  A calm, centred composition: a breathing voice mark (three dots pulsing    */
/*  vertically inside three rings that breathe outward — the outer ring the     */
/*  only colour), headline, subline, the Accept CTA, and the consent line.      */
/*  Accepting fades the screen out (200ms) then calls onAccept (the §12 consent │
/*  gate → Intake); onAccept writes the localStorage consent flag.             */
/*                                                                            */
/*  Rendered inside WillabSurface's shell — the NAVBAR (DashboardHeader) is     */
/*  provided there and is intentionally left untouched. The Privacy/Terms       */
/*  links at the foot are likewise left as-is per the request.                 */
/* -------------------------------------------------------------------------- */

export default function WelcomeConsent({ onAccept }: { onAccept: () => void }) {
  // Fade-out on enter: opacity-0 over 200ms, then continue at ~220ms.
  const [leaving, setLeaving] = useState(false);
  const enter = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onAccept, 220);
  };

  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center px-6 text-center transition-opacity duration-200 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Breathing voice mark (decorative) */}
      <div
        className="relative mb-10 flex h-40 w-40 items-center justify-center"
        aria-hidden="true"
      >
        <span className="breath-ring absolute inset-0 rounded-full border border-foreground/10" />
        <span
          className="breath-ring absolute inset-3 rounded-full border border-foreground/15"
          style={{ animationDelay: "0.6s" }}
        />
        <span
          className="breath-ring absolute inset-6 rounded-full border border-primary/30"
          style={{ animationDelay: "1.2s" }}
        />
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
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

      <h1 className="max-w-[16ch] text-[34px] font-semibold leading-[1.05] tracking-tight text-foreground sm:text-[40px]">
        Turn your stress into charisma
      </h1>
      <p className="mt-3 max-w-[28ch] text-[14px] text-muted-foreground">
        Step by step, at your own pace.
      </p>

      <button
        type="button"
        onClick={enter}
        className="group mt-10 inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-7 text-[14px] font-medium text-background transition hover:bg-foreground/90 active:scale-[0.98]"
      >
        Accept &amp; enter the lab
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 rounded-full bg-primary transition-transform group-hover:translate-x-0.5"
        />
      </button>

      <p className="mt-6 max-w-[34ch] text-[11px] leading-relaxed text-muted-foreground/80">
        Voice tasks may be reviewed by a human coach under a pseudonymous ID. By
        entering the lab you accept our terms &amp; policy.
      </p>

      {/* Footer links — left untouched per the request. */}
      <p className="mt-3 text-[12px] text-muted-foreground">
        <a href="/privacy" className="underline hover:text-foreground">
          Privacy
        </a>
        {" · "}
        <a href="/terms" className="underline hover:text-foreground">
          Terms
        </a>
      </p>
    </div>
  );
}
