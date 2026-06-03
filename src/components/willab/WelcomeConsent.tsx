"use client";

import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/*  WelcomeConsent — first-run screen (§12)                                    */
/*                                                                            */
/*  One lightweight screen: what the tool does + the recording/privacy        */
/*  disclosure (naming both data paths) + Accept-to-continue. NOT account      */
/*  creation — sign-up is deferred to the Send gate (§13). Accepting writes a  */
/*  localStorage flag (no account yet to attach to); the server-side consent   */
/*  record is written at sign-up, BE-side. Shown once — `useWillabFlow`        */
/*  routes returning users straight past it.                                  */
/*                                                                            */
/*  Rendered inside WillabSurface's shell (header + container provided there).*/
/* -------------------------------------------------------------------------- */

export default function WelcomeConsent({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-2 text-center">
      <h1 className="text-[17px] font-semibold text-foreground">willab</h1>
      <p className="mt-1 max-w-sm text-[15px] leading-relaxed text-foreground">
        See how you actually sound, then get a real coach&apos;s read.
      </p>

      <ul className="mt-6 w-full max-w-xs space-y-1.5 text-left text-[15px] text-foreground">
        <li>• Record a short speaking task</li>
        <li>• See the raw data of your voice</li>
        <li>• A human coach sends you insights</li>
      </ul>

      <p className="mt-6 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
        We record your Lab task and may send it to a human coach, who reviews it
        under a pseudonymous ID. Your Lounge chats are saved just for your own
        continuity — never used to judge you.
      </p>

      <Button onClick={onAccept} className="mt-6 rounded-full px-6">
        Accept &amp; continue
      </Button>

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
