"use client";

import { Loader2 } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useWillabFlow } from "./useWillabFlow";
import WelcomeConsent from "./WelcomeConsent";
import Intake from "./Intake";
import Lounge from "./Lounge";
import LabOverlay from "./LabOverlay";
import { LoungeThreadProvider } from "./LoungeThreadContext";

/* -------------------------------------------------------------------------- */
/*  WillabSurface — restructure SHELL root (feature-flagged)                   */
/*                                                                            */
/*  Renders the willab-beta structure: first-run screens (Welcome → Intake),  */
/*  then the always-mounted Lounge home with the Lab as an overlay layered     */
/*  over it. Welcome (§12), Intake (§2), Lounge (§3) and the Lab front-half     */
/*  (§4: session_context + record capture) are real; the Lab's processing /     */
/*  Readout / Send tail (§5/§13) is the BE-gated seam, walkable via stubs       */
/*  inside LabOverlay until the upload handler (BE ③) lands.                   */
/* -------------------------------------------------------------------------- */

export default function WillabSurface({
  sessionId,
}: {
  sessionId: string | null;
}) {
  const flow = useWillabFlow();

  const shell = (children: React.ReactNode) => (
    <main className="willab-chat flex h-full flex-col overflow-hidden bg-background">
      <div className="shrink-0">
        <DashboardHeader />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-4 py-6">
        {children}
      </div>
    </main>
  );

  // Resolving the initial state post-mount (hydration-safe).
  if (flow.state === null) {
    return shell(
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // First-run, full-screen (no Lounge underneath yet).
  if (flow.state === "welcome_consent") {
    return shell(<WelcomeConsent onAccept={flow.acceptConsent} />);
  }
  if (flow.state === "intake_in_progress") {
    return shell(<Intake onDone={flow.finishIntake} />);
  }

  // Home: the always-mounted Lounge, with the Lab overlay layered when open.
  // Both share one thread (LoungeThreadProvider) so the Lab can persist a
  // recording's Readout into the same scrollable history.
  return shell(
    <LoungeThreadProvider>
      <Lounge state={flow.state} onStart={flow.startRecording} goTo={flow.goTo} />
      {flow.labOverlayOpen && (
        <LabOverlay
          state={flow.state}
          sessionId={sessionId}
          goTo={flow.goTo}
          onClose={flow.closeLab}
        />
      )}
    </LoungeThreadProvider>
  );
}
