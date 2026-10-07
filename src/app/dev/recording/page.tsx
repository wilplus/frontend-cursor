"use client";

import { useEffect, useState } from "react";
import { RecordingPhase, RecordingWhere } from "@/components/willab/LabOverlay";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import { DEFAULT_DECK } from "@/lib/willab/defaultDeck";
import { SCREEN_BOTTOM_GAP } from "@/lib/screenChrome";
import { useNoPullToRefresh } from "@/lib/willab/useNoPullToRefresh";
import type { PresentationSlide } from "@/components/willab/presentation";

/* -------------------------------------------------------------------------- */
/*  A harness for the RECORDING screen (founder respec 2026-08-11).            */
/*                                                                            */
/*  The real screen needs a live mic and a submitted setup form, which is      */
/*  precisely why its layout went unchecked: nothing could open it without     */
/*  getUserMedia. This mounts the real component with a recording mic state    */
/*  and the default deck, inside the same chrome LabOverlay wraps it in.       */
/*                                                                            */
/*    ?t=90     seconds elapsed (drives the clock + the bar)                   */
/*    ?target=  the setup target in seconds (default 1500 = 25 min)            */
/*    ?slide=   which slide to open on                                        */
/*    ?take=    the Take shown in the top bar (default 2)                     */
/*    ?learn=1  open on Take 1's learning screen (the mic held, not recording) */
/*    ?mic=1    open on "Getting your mic ready", then the screen glides in    */
/*                                                                            */
/*  DEV ONLY. Production renders nothing.                                     */
/* -------------------------------------------------------------------------- */

const SLIDES: PresentationSlide[] = DEFAULT_DECK.map((s) => ({
  title: s.title,
  body: s.body,
  artworkSrc: s.artworkSrc,
}));

const DEMO_ROOTS = [
  { slideIndex: 0, text: "Open with the one idea", type: "flagship" as const },
  { slideIndex: 0, text: "Show why it matters now", type: "neutral" as const },
  { slideIndex: 1, text: "Make the audience benefit concrete", type: "neutral" as const },
  { slideIndex: 2, text: "End with the next action", type: "flagship" as const },
];

type MicStatus = "idle" | "recording";

export default function RecordingHarness() {
  const [slide, setSlide] = useState(0);
  const [{ elapsed, target }, setClock] = useState({
    elapsed: 150,
    target: 1500,
  });
  const [take, setTake] = useState(2);
  const [mic, setMic] = useState<{ status: MicStatus; armed: boolean }>({
    status: "recording",
    armed: false,
  });
  // AFTER mount, never during render: the query string does not exist on the
  // server, so reading it in the render pass makes the first client paint
  // disagree with the server's and React throws the whole tree away.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setSlide(Number(q.get("slide") ?? 0));
    setClock({
      elapsed: Number(q.get("t") ?? 150),
      target: Number(q.get("target") ?? 1500),
    });
    const learn = q.get("learn") === "1";
    setTake(learn ? 1 : Number(q.get("take") ?? 2));
    if (learn) setMic({ status: "idle", armed: true });
    if (q.get("mic") === "1") {
      setMic({ status: "idle", armed: false });
      window.setTimeout(() => setMic({ status: "recording", armed: false }), 1200);
    }
  }, []);
  // LabOverlay holds pull-to-refresh off while it records; the mirror does
  // the same so the gesture can be checked here.
  useNoPullToRefresh(true);
  if (process.env.NODE_ENV === "production") return null;

  return (
    // The LabOverlay shell, mirrored: fixed column, the h-12 header with
    // "Take · Slide" and the one way out, then the slot the phases render into.
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between px-4">
        <RecordingWhere
          show
          micStatus={mic.status}
          takeNumber={take}
          slide={slide}
          slideCount={SLIDES.length}
        />
        <OverlayCloseButton onClick={() => {}} />
      </header>
      <div
        className={`scrollbar-none mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden px-4 pt-6 ${SCREEN_BOTTOM_GAP}`}
      >
        <RecordingPhase
          micState={
            mic.status === "recording"
              ? { status: "recording", partialText: "" }
              : { status: "idle" }
          }
          armed={mic.armed}
          onBegin={() => setMic({ status: "recording", armed: false })}
          elapsed={elapsed}
          targetSec={target}
          rejectedMsg={null}
          uploadRetry={null}
          onStop={() => {}}
          onRecordAgain={() => {}}
          slides={SLIDES}
          presentationRef={null}
          currentSlide={slide}
          roots={take > 1 ? DEMO_ROOTS : []}
          onSlideChange={setSlide}
        />
      </div>
    </div>
  );
}
