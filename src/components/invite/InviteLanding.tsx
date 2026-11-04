"use client";

import { useState } from "react";
import Link from "next/link";
import WelcomeExample from "@/components/willab/WelcomeExample";
import { SEE_AN_EXAMPLE } from "@/components/willab/WelcomeConsent";
import LinkField from "./LinkField";
import { INVITE_COPY, WAITLIST_HREF } from "./inviteCopy";

/* -------------------------------------------------------------------------- */
/*  The first page, by invitation (backend N471 item 4, design B; prototype   */
/*  https://claude.ai/artifact/HSELYXuS99xctnHRVBo1e4, version 13). The same  */
/*  page on the web and in the iPhone app: "Sign in" in the corner, the       */
/*  breathing mark, the name, "See an example" under it (the two lines that   */
/*  were there went: founder, "you can remove it"), the link field, and       */
/*  "No link yet? Join the waitlist". "Enter the lab" went: nobody walks in   */
/*  without a link. The example's "Try it with your talk" comes back here,    */
/*  to the field.                                                             */
/*                                                                            */
/*  The first-run welcome inside the app (WelcomeConsent, the consent          */
/*  screens' first step) is a different screen and stays as it is.           */
/* -------------------------------------------------------------------------- */

export default function InviteLanding() {
  const [example, setExample] = useState(false);
  const [focusField, setFocusField] = useState(false);

  return (
    <div data-invite-landing="" className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <Link
        href="/login"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] px-2 py-1 text-[14px] text-muted-foreground transition-colors hover:text-foreground"
      >
        {INVITE_COPY.signIn}
      </Link>
      <div className="m-auto flex w-full flex-col items-center px-6 py-6 text-center">
        <div className="relative mb-10 flex h-40 w-40 items-center justify-center" aria-hidden="true">
          <span className="breath-ring absolute inset-0 rounded-full border border-foreground/10" />
          <span className="breath-ring absolute inset-3 rounded-full border border-foreground/15" style={{ animationDelay: "0.6s" }} />
          <span className="breath-ring absolute inset-6 rounded-full border border-primary/30" style={{ animationDelay: "1.2s" }} />
          <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
            <circle className="welcome-voice-dot" cx="12" cy="28" r="4" fill="hsl(var(--foreground))" />
            <circle className="welcome-voice-dot" cx="28" cy="28" r="6" fill="hsl(var(--foreground))" />
            <circle className="welcome-voice-dot" cx="44" cy="28" r="4" fill="hsl(var(--foreground))" />
          </svg>
        </div>
        <h1 className="text-[40px] font-semibold leading-[1.05] tracking-tight text-foreground sm:text-[48px]">
          WillpowerLab
        </h1>
        <button
          type="button"
          onClick={() => setExample(true)}
          className="mt-2.5 inline-flex h-11 items-center gap-2 px-2 text-[14px] text-foreground transition-colors hover:text-foreground/80"
        >
          <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
            <svg width="8" height="9" viewBox="0 0 12 13" aria-hidden="true">
              <path d="M2 1.2v10.6L11 6.5z" fill="#fff" />
            </svg>
          </span>
          {SEE_AN_EXAMPLE}
        </button>
        <div className="mt-6 flex w-full justify-center">
          <LinkField key={focusField ? "focus" : "rest"} autoFocus={focusField} />
        </div>
        <Link
          href={WAITLIST_HREF}
          className="mt-1 px-2 py-1 text-[13px] text-muted-foreground underline decoration-foreground/30 underline-offset-[3px] hover:text-foreground"
        >
          {INVITE_COPY.joinWaitlist}
        </Link>
      </div>
      {example ? (
        <WelcomeExample
          onTry={() => {
            setExample(false);
            setFocusField(true);
          }}
          onClose={() => setExample(false)}
        />
      ) : null}
    </div>
  );
}
