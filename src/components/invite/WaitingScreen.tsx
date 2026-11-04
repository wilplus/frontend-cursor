"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LinkField from "./LinkField";
import { INVITE_COPY } from "./inviteCopy";

/* -------------------------------------------------------------------------- */
/*  "You're on the waitlist" (backend N471 items 3 and 9): what a signed-in   */
/*  account that has not joined through a link sees, every time it opens the  */
/*  app. The founder answers the waitlist email with his link; opening it, or */
/*  pasting any member's link here, lets the person in. Nothing else to do.   */
/* -------------------------------------------------------------------------- */

export default function WaitingScreen() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setEmail(data.user?.email ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <main data-waiting-screen="" className="flex min-h-[100dvh] flex-col bg-background">
      <div className="m-auto flex w-full max-w-[400px] flex-col items-center px-6 py-10 text-center">
        <div className="relative mb-8 flex h-24 w-24 items-center justify-center" aria-hidden="true">
          <span className="breath-ring absolute inset-0 rounded-full border border-foreground/10" />
          <span className="breath-ring absolute inset-2 rounded-full border border-foreground/15" style={{ animationDelay: "0.6s" }} />
          <span className="breath-ring absolute inset-4 rounded-full border border-primary/30" style={{ animationDelay: "1.2s" }} />
        </div>
        <h1 className="text-balance text-[24px] font-bold leading-tight text-foreground">{INVITE_COPY.waitingTitle}</h1>
        {email ? (
          <p className="mt-2.5 max-w-[30ch] text-[15px] leading-relaxed text-muted-foreground">
            {INVITE_COPY.waitingLine(email)}
          </p>
        ) : null}
        <div className="mt-7 flex w-full justify-center">
          <LinkField />
        </div>
      </div>
    </main>
  );
}
