"use client";

import { useState } from "react";
import ReadySignUpScreen from "@/components/willab/ReadySignUpScreen";

/* -------------------------------------------------------------------------- */
/*  Dev harness for the "processing is done" screen a guest sees instead of    */
/*  the readout (ReadySignUpScreen, founder 2026-10-16). In the product it     */
/*  opens over the Lab's wait and over the guest Lounge; here it opens over    */
/*  nothing, with the two answers logged. "Not now" closes it; "Show it        */
/*  again" (dev only) brings it back.                                          */
/*                                                                            */
/*  DEV ONLY. Production renders nothing — this is a fixture, not a surface.   */
/* -------------------------------------------------------------------------- */

export default function ReadySignUpHarness() {
  const [open, setOpen] = useState(true);
  const [last, setLast] = useState<string | null>(null);
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-[13px] text-muted-foreground">
      <p data-dev-last>{last ? `last answer: ${last}` : "no answer yet"}</p>
      <button
        type="button"
        className="underline underline-offset-4"
        onClick={() => setOpen(true)}
      >
        Show it again
      </button>
      {open ? (
        <ReadySignUpScreen
          onSignUp={() => {
            setLast("Create an account");
            setOpen(false);
          }}
          onNotNow={() => {
            setLast("Not now");
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
