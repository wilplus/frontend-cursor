"use client";

import { useEffect, useState } from "react";
import { labColumnClass, RecordingWhere } from "@/components/willab/LabOverlay";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import ProcessingWait from "@/components/willab/ProcessingWait";

/* -------------------------------------------------------------------------- */
/*  A harness for THE ONE WAITING SCREEN (ProcessingWait) as the Lab shows it  */
/*  after a Take is uploaded (state `lab_processing`). The real screen only    */
/*  appears behind a live recording and a running pipeline; this mounts the    */
/*  same component inside the same LabOverlay chrome with a frozen stage, so   */
/*  the label and the bar can be looked at without waiting for a server.       */
/*                                                                            */
/*    ?stage=    the pipeline stage the marker reports (default `ideal_text`,  */
/*               which reads "Building your Ideal Text")                      */
/*    ?percent=  the reported percent (default 55)                            */
/*                                                                            */
/*  DEV ONLY. Production renders nothing — this is a fixture, not a surface.   */
/* -------------------------------------------------------------------------- */

export default function ProcessingWaitHarness() {
  const [progress, setProgress] = useState({ stage: "ideal_text", percent: 55 });
  // After mount, never during render: the query string does not exist on the
  // server, and a first client paint that disagrees with it is thrown away.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setProgress({
      stage: q.get("stage") ?? "ideal_text",
      percent: Number(q.get("percent") ?? 55),
    });
  }, []);
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between px-4">
        <RecordingWhere show={false} micStatus="idle" takeNumber={1} slide={0} slideCount={0} />
        <OverlayCloseButton onClick={() => {}} />
      </header>
      <div className={labColumnClass("lab_processing", "idle")}>
        <div className="flex flex-1 flex-col items-center justify-start pt-1 text-center sm:pt-3">
          <ProcessingWait progress={progress} cycleStartedAt={null} />
        </div>
      </div>
    </div>
  );
}
