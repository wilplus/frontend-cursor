"use client";

import { useEffect, useRef, useState } from "react";
import { recordFeeling, type Feeling } from "./willabFeelings";

/* -------------------------------------------------------------------------- */
/*  FeelingsCheckIn — first-recording onboarding, step 0 (U10)                 */
/*                                                                            */
/*  A one-time, warm check-in before the user's first official recording: name */
/*  how you feel, get a reassuring line back, then step into the Lab. The act   */
/*  of naming the state is the point — it takes the edge off the mic. The       */
/*  choice is captured FE-local (willabFeelings) under the BE freeze; it drives  */
/*  the reply now and wires to the coach later.                                 */
/*                                                                            */
/*  No judgement, no score — every feeling gets an encouraging, non-evaluative  */
/*  reply. Chips match the Lab's existing preset-chip styling for continuity.   */
/* -------------------------------------------------------------------------- */

const FEELINGS: { key: Feeling; label: string; reply: string }[] = [
  {
    key: "nervous",
    label: "Nervous",
    reply: "Nerves mean it matters. That's exactly the voice worth training.",
  },
  {
    key: "excited",
    label: "Excited",
    reply: "Love that energy. Let's catch it on the record.",
  },
  {
    key: "calm",
    label: "Calm",
    reply: "Great headspace. Let's put it to work.",
  },
  {
    key: "unsure",
    label: "Not sure",
    reply: "That's fine. The recorder doesn't judge. Just talk; we'll find the signal.",
  },
];

export default function FeelingsCheckIn({ onReady }: { onReady: () => void }) {
  // FE-3 — nothing is pre-selected; the user names how they feel fresh every
  // time (the old one-tap "same as before" shortcut was removed).
  const [picked, setPicked] = useState<Feeling | null>(null);
  const reply = FEELINGS.find((f) => f.key === picked)?.reply ?? null;
  // ④ — no "I'm ready" button: naming the feeling shows the reassuring line,
  // then auto-advances into setup after a beat. The first tap wins.
  const advanceRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (advanceRef.current) window.clearTimeout(advanceRef.current);
    },
    []
  );

  function pick(feeling: Feeling) {
    if (picked) return; // first tap wins; ignore taps while the reply shows
    setPicked(feeling);
    recordFeeling(feeling); // FE-local under the freeze; wires to the coach later
    advanceRef.current = window.setTimeout(onReady, 1000);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-2">
        <h2 className="text-[20px] font-semibold text-foreground">
          Before you step on stage
        </h2>
        <p className="mt-1 text-[15px] text-muted-foreground">
          How are you feeling about this one?
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {FEELINGS.map((f) => {
          const active = picked === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => pick(f.key)}
              disabled={picked !== null && !active}
              aria-pressed={active}
              className={`rounded-full border px-4 py-2 text-[15px] transition-colors disabled:opacity-50 ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:border-primary/50"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {reply ? (
        <div className="mt-5 rounded-2xl bg-primary/5 p-4">
          <p className="text-[15px] leading-relaxed text-foreground">{reply}</p>
        </div>
      ) : null}
    </div>
  );
}
