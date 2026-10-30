"use client";

import { useState } from "react";
import WelcomeExample from "./WelcomeExample";

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

/** Under the name (founder 2026-10-30, N277, on its prototype): two short
 *  paragraphs, each broken where the founder broke it. Replaces N273's
 *  "Record your talk. You get the ideal text…". */
export const WELCOME_PROMISE: readonly (readonly [string, string])[] = [
  ["Great presentations aren’t about slides.", "They’re about a dream and the guts to deliver it."],
  ["You bring the dream.", "We’ll help you sound brave until you are 😏"],
];
export const SEE_AN_EXAMPLE = "See an example";

/* "Read blog posts" is gone (N277): the posts sit right under the welcome. */
export default function WelcomeConsent({ onAccept }: { onAccept: () => void }) {
  // Fade-out on enter: opacity-0 over 200ms, then continue at ~220ms.
  const [leaving, setLeaving] = useState(false);
  const enter = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onAccept, 220);
  };
  // "See an example" (N273 item 1; N277): one example over the whole page;
  // its "Try it with your talk" enters as Enter does.
  const [example, setExample] = useState(false);

  /* ITS OWN SCROLLER, FROM ITS TRUE TOP (consent lock 2026-10-07: "every
     step scrolls from its true top to its last button on any phone"). The
     column was centred with `justify-center` inside a shell that clips, so on
     a short screen (a phone on its side) it spilled off both ends: the mark
     was cut at the top and "Enter the lab" could not be reached. `m-auto`
     centres the column while it fits and collapses once it is taller, leaving
     an ordinary scroll from the top; py-6 keeps the breathing rings clear of
     the edge. 24px sides, as the prototype's `.wel`. */
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-y-auto transition-opacity duration-200 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="m-auto flex flex-col items-center px-6 py-6 text-center">
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
            promises a state the product cannot deliver. Founder-signed.

            Founder 2026-09-30: now "Public speaking excellence tool", which names
            what the tool is for, still without promising an outcome.

            Founder 2026-10-29 (N273 item 1): now the page's own description,
            which names the deliverable, and "See an example" shows it.

            Founder 2026-10-30 (N277): now the two paragraphs above, on the
            prototype. The founder lifted the honest-positioning rule for this
            line in N277; it still binds everything else. */}
        <h1 className="text-[40px] font-semibold leading-[1.05] tracking-tight text-foreground sm:text-[48px]">
          WillpowerLab
        </h1>
        {WELCOME_PROMISE.map(([first, second], i) => (
          <p
            key={first}
            className={`${i === 0 ? "mt-3.5" : "mt-2.5"} max-w-[36ch] text-[15px] leading-relaxed text-muted-foreground`}
          >
            {first}
            <br />
            {second}
          </p>
        ))}

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

          <button
            type="button"
            onClick={() => setExample(true)}
            className="mt-1 inline-flex h-11 items-center gap-2 px-2 text-[14px] text-foreground transition-colors hover:text-foreground/80"
          >
            <span
              aria-hidden="true"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-primary"
            >
              <svg width="8" height="9" viewBox="0 0 12 13" aria-hidden="true">
                <path d="M2 1.2v10.6L11 6.5z" fill="#fff" />
              </svg>
            </span>
            {SEE_AN_EXAMPLE}
          </button>
        </div>
      </div>
      {example ? <WelcomeExample onTry={enter} onClose={() => setExample(false)} /> : null}
    </div>
  );
}
