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

export default function WelcomeConsent({
  onAccept,
  /** Landing only. When given, a secondary "Read blog posts" action renders
   *  under the CTA and calls this. The in-app first run has no journal strip
   *  beneath it, so the button would scroll to nothing and is omitted there. */
  onReadJournal,
}: {
  onAccept: () => void;
  onReadJournal?: () => void;
}) {
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

      {/* Founder 2026-09-18. The wordmark carries the brand and the line under
          it says what the product is for.

          The previous headline — "Your best talk, in your own words" — was
          written under the honest-positioning rule of 2026-07-17: promise the
          deliverable, never a feeling. That rule still stands and this wording
          was weighed against it: "reduce public speaking anxiety" describes
          what the tool is for, not an outcome it guarantees, and nothing here
          promises a state the product cannot deliver. Founder-signed. */}
      <h1 className="text-[40px] font-semibold leading-[1.05] tracking-tight text-foreground sm:text-[48px]">
        WillpowerLab
      </h1>
      <p className="mt-3.5 max-w-[36ch] text-[15px] leading-relaxed text-muted-foreground">
        A tool to reduce public speaking anxiety.
      </p>

      {/* THE CTA NO LONGER CLAIMS ACCEPTANCE. It read "Accept & enter the lab"
          with fine print saying that entering accepted the terms. Acceptance now
          belongs to the Phase-1 flow (Phase1AcceptanceGate), which records a
          receipt against the exact document versions — so a button that quietly
          accepted on a marketing page would be claiming consent the receipt
          cannot evidence. It says what it does: it enters. */}
      <div className="mt-10 flex flex-col items-center">
        <button
          type="button"
          onClick={enter}
          className="group inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-7 text-[14px] font-medium text-background transition hover:bg-foreground/90 active:scale-[0.98]"
        >
          Enter the lab
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full bg-primary transition-transform group-hover:translate-x-0.5"
          />
        </button>

        {onReadJournal ? (
          <button
            type="button"
            onClick={onReadJournal}
            className="mt-1 h-11 px-2 text-[14px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Read blog posts
          </button>
        ) : null}
      </div>
    </div>
  );
}
