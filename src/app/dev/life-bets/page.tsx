"use client";

import { useState } from "react";
import { BetsStep } from "@/components/life/SetupFlow";
import { coerceSetupAnswers, type LifeSetupAnswers } from "@/lib/life/setupSteps";

/* -------------------------------------------------------------------------- */
/*  A harness for the three-bets reorder, so press-hold-move can be driven in  */
/*  a REAL browser.                                                            */
/*                                                                            */
/*  The real screen sits behind /panel, which is signed-in only and gated      */
/*  again on the `/v2/life/state` payload — unreachable without a backend. And */
/*  the things that break a hand-rolled drag are not reducible to unit tests:  */
/*  whether a touch pans the page instead of dragging the row, whether a hold  */
/*  on the textarea steals the caret, whether the pointer is still tracked     */
/*  after it leaves the row. That needs an engine with real pointer plumbing.  */
/*                                                                            */
/*  DEV ONLY. Production renders nothing — this is a test fixture, not a       */
/*  surface, and it must not become one.                                       */
/* -------------------------------------------------------------------------- */

export default function LifeBetsHarness() {
  const [answers, setAnswers] = useState<LifeSetupAnswers>(() =>
    coerceSetupAnswers(null)
  );

  if (process.env.NODE_ENV === "production") return null;

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Your three bets</h1>
      <BetsStep answers={answers} onChange={setAnswers} />
      {/* The committed order, for a spec to assert against. */}
      <pre data-testid="order" className="mt-6 text-xs text-muted-foreground">
        {answers.bets.map((b) => `${b.rank}:${b.key}`).join(" ")}
      </pre>
    </main>
  );
}
