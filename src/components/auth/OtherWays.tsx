'use client';

import { Button } from "@/components/ui/button";
import LinkedInAuthButton from "@/components/auth/LinkedInAuthButton";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import AppleAuthButton from "@/components/auth/AppleAuthButton";
import MicrosoftAuthButton, { microsoftSignInOn } from "@/components/auth/MicrosoftAuthButton";

/* -------------------------------------------------------------------------- */
/*  OtherWays — under the WhatsApp number on the sign-up and sign-in pages    */
/*  (founder 2026-10-28, backend N232): "or", then three small buttons of     */
/*  one size, Email, LinkedIn and Google, their logos in black and white;     */
/*  "Microsoft" beside Google once switched on (N401 item 6).                 */
/* -------------------------------------------------------------------------- */

export const OTHER_WAYS_COPY = { or: "or", email: "Email" } as const;

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6 8.5-6" />
    </svg>
  );
}

export default function OtherWays({ mode, onEmail }: { mode: "signup" | "login"; onEmail: () => void }) {
  const small = "h-12 rounded-xl px-2 text-sm";
  // "Microsoft" beside Google (backend N401 item 6) once it is switched on;
  // four buttons sit two by two so each name fits a phone.
  const microsoft = microsoftSignInOn();
  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.08em] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {OTHER_WAYS_COPY.or}
        <span className="h-px flex-1 bg-border" />
      </div>
      {/* In the iPhone app only, Apple's own button above the three (N365). */}
      <AppleAuthButton />
      <div className={`grid gap-3 ${microsoft ? "grid-cols-2" : "grid-cols-3"}`}>
        <Button type="button" variant="outline" className={`w-full gap-2 font-medium ${small}`} onClick={onEmail}>
          <MailIcon className="h-[18px] w-[18px] shrink-0" />
          <span>{OTHER_WAYS_COPY.email}</span>
        </Button>
        <LinkedInAuthButton mode={mode} compact className={small} />
        <GoogleAuthButton mode={mode} compact className={small} />
        {microsoft ? <MicrosoftAuthButton className={small} /> : null}
      </div>
    </div>
  );
}
