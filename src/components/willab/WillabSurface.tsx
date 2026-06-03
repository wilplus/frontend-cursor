"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useWillabFlow, type WillabState } from "./useWillabFlow";
import WelcomeConsent from "./WelcomeConsent";
import Intake from "./Intake";
import Lounge from "./Lounge";

/* -------------------------------------------------------------------------- */
/*  WillabSurface — restructure SHELL root (feature-flagged)                   */
/*                                                                            */
/*  Renders the willab-beta structure: first-run screens (Welcome → Intake),  */
/*  then the always-mounted Lounge home with the Lab as an overlay layered     */
/*  over it. Surfaces are STUBS — each later slice swaps a stub for the real    */
/*  component (Welcome §12, Intake §2, Lounge §3, Lab §4, Readout §5, …).      */
/*  The structure (flag gate, state machine, overlay-over-Lounge) is the       */
/*  deliverable; the stubs prove it's navigable end to end.                   */
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
  return shell(
    <>
      <Lounge state={flow.state} onStart={flow.startRecording} goTo={flow.goTo} />
      {flow.labOverlayOpen && (
        <LabOverlayStub
          state={flow.state}
          sessionId={sessionId}
          goTo={flow.goTo}
          onClose={flow.closeLab}
        />
      )}
    </>
  );
}

/* ----------------------------- shell stubs -------------------------------- */

function StubBadge({ label }: { label: string }) {
  return (
    <span className="mb-3 inline-block rounded-full border border-dashed border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
      shell stub · {label}
    </span>
  );
}

function LabOverlayStub({
  state,
  sessionId,
  goTo,
  onClose,
}: {
  state: WillabState;
  sessionId: string | null;
  goTo: (s: WillabState) => void;
  onClose: () => void;
}) {
  // Minimal forward nav through the Lab states to prove the overlay flow.
  const next: Partial<Record<WillabState, WillabState>> = {
    lab_session_context: "lab_prerecord",
    lab_prerecord: "lab_recording",
    lab_recording: "lab_processing",
    lab_processing: "readout",
    readout: sessionId ? "sendgate_signed" : "sendgate_unsigned",
    sendgate_unsigned: "review_pending",
    sendgate_signed: "review_pending",
  };
  const advance = next[state];

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      {/* training-zone chrome (§4) */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-[13px] font-semibold text-foreground">
          Official recording · not yet sent
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[13px] text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <StubBadge label="Lab overlay (§4/§5/§13)" />
        <p className="text-[15px] text-muted-foreground">
          step: <code className="text-foreground">{state}</code>
        </p>
        {advance ? (
          <Button
            onClick={() => goTo(advance)}
            className="rounded-full px-5"
          >
            Next → {advance}
          </Button>
        ) : (
          <Button onClick={onClose} variant="outline" className="rounded-full px-5">
            Back to Lounge
          </Button>
        )}
      </div>
    </div>
  );
}
