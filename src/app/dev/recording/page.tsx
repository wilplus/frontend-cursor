"use client";

import { useEffect, useState } from "react";
import { RecordingPhase } from "@/components/willab/LabOverlay";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import { DEFAULT_DECK } from "@/lib/willab/defaultDeck";
import { SCREEN_BOTTOM_GAP } from "@/lib/screenChrome";
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
/*                                                                            */
/*  DEV ONLY. Production renders nothing.                                     */
/* -------------------------------------------------------------------------- */

const SLIDES: PresentationSlide[] = DEFAULT_DECK.map((s) => ({
  title: s.title,
  body: s.body,
}));

export default function RecordingHarness() {
  const [slide, setSlide] = useState(0);
  const [{ elapsed, target }, setClock] = useState({
    elapsed: 150,
    target: 1500,
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
  }, []);
  if (process.env.NODE_ENV === "production") return null;

  return (
    // The LabOverlay shell, mirrored: fixed column, the h-12 header with the
    // screen's name and the one way out, then the scroll slot the phases
    // render into.
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between px-4">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Recording
        </span>
        <OverlayCloseButton onClick={() => {}} />
      </header>
      <div
        className={`scrollbar-none mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 pt-6 ${SCREEN_BOTTOM_GAP}`}
      >
        <RecordingPhase
          micState={{ status: "recording", partialText: "" }}
          elapsed={elapsed}
          targetSec={target}
          rejectedMsg={null}
          uploadRetry={null}
          onStop={() => {}}
          onRecordAgain={() => {}}
          slides={SLIDES}
          presentationRef={null}
          currentSlide={slide}
          roots={[]}
          onAdvance={(dir) =>
            setSlide((i) => Math.min(Math.max(i + dir, 0), SLIDES.length - 1))
          }
        />
      </div>
    </div>
  );
}
