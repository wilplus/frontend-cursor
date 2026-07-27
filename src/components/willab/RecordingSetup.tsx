"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import PresentationInput from "./PresentationInput";
import { type LabSessionContext } from "./LabOverlay";
import { type ExploreArcDeck } from "@/lib/willab/exploreArc";
import {
  clampSlides,
  initialSlides,
  nonEmptySlides,
  type PresentationSlide,
} from "./presentation";

/* -------------------------------------------------------------------------- */
/*  RecordingSetup — what is asked before the mic opens                        */
/*                                                                            */
/*  RECORDING IN ETERNITY (founder 2026-07-27). The five-step wizard is gone.  */
/*  There is no length step, no audience step and no strategic-context step:   */
/*  the user records and stops when they feel it is good enough. What is left  */
/*  is one screen, and only because two things on it are load-bearing rather   */
/*  than nice to have:                                                        */
/*                                                                            */
/*    TOPIC  — posted on every upload; analysis needs it.                      */
/*    SLIDES — the ONLY input to per-slide segmentation. The deck attached     */
/*             here is what renders SlideStage during recording, which is what */
/*             the user taps, which is what produces slide_advances, which is  */
/*             what buckets each word to the slide that was on screen when it  */
/*             was spoken. Drop this and every recording is deckless and the   */
/*             ideal text assembles as a single block. Optional per take —     */
/*             deckless is a supported mode — but the affordance has to        */
/*             survive, or deckless becomes the only mode.                     */
/*                                                                            */
/*  Everything the wizard used to collect and no longer does is simply not     */
/*  sent. Audience still arrives on a CONTINUATION, where it comes from the    */
/*  server's stored setup rather than from a form.                             */
/*                                                                            */
/*  The "Start recording" tap IS the user gesture getUserMedia needs, so it    */
/*  must call onSubmit synchronously (the parent starts the mic in the same    */
/*  click) — no async work sits between the tap and onSubmit.                  */
/* -------------------------------------------------------------------------- */

const SETUP_INPUT_CLS =
  "w-full h-12 rounded-xl border border-border bg-background px-4 text-[15px] placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition";

/** The 3-take nudge that replaces the wizard.
 *
 *  Reused VERBATIM from the readout, where it is already founder-signed-off,
 *  rather than written fresh — the two places a user is told this must not say
 *  it two different ways, and reuse means no new copy to sign off. The live
 *  "Take N of 3" counter during recording is the third leg of the same nudge
 *  and is unchanged. */
export const THREE_TAKE_NUDGE =
  "Your ideal text gets sharper with more takes. Three is where it really lands.";

export default function RecordingSetup({
  preloadDeck,
  hideDeck = false,
  onSubmit,
}: {
  /** Continuing a known deck — pre-fill topic and slides. */
  preloadDeck: ExploreArcDeck | null;
  /** Skip the deck entirely (deckless-only flows, e.g. a staged footer upload,
   *  which is a standalone file rather than a take of a project). */
  hideDeck?: boolean;
  onSubmit: (ctx: LabSessionContext, explore: boolean) => void;
}) {
  const [topic, setTopic] = useState("");
  const [slides, setSlides] = useState<PresentationSlide[]>(initialSlides());
  const [presentationRef, setPresentationRef] = useState<string | null>(null);
  // Not collected any more, but still carried: on a continuation the server's
  // stored setup is the source, and dropping it here would quietly strip a
  // project's audience on its second take.
  const [audience, setAudience] = useState("");

  // Pre-fill once from the arc's deck (record-another-take into a known deck).
  const didPreloadRef = useRef(false);
  useEffect(() => {
    if (didPreloadRef.current || !preloadDeck) return;
    didPreloadRef.current = true;
    if (preloadDeck.topic) setTopic(preloadDeck.topic);
    if (preloadDeck.audience) setAudience(preloadDeck.audience);
    if (preloadDeck.slides.length > 0) setSlides(preloadDeck.slides);
    setPresentationRef(preloadDeck.presentationRef);
    // targetLengthSeconds is deliberately NOT restored: there is no target any
    // more, on a first take or a fifth. The clock counts up from zero and never
    // turns red, which is what "stop when it is good enough" means.
  }, [preloadDeck]);

  const topicReady = topic.trim().length > 0;

  function submit() {
    const t = topic.trim();
    if (!t) return;
    onSubmit(
      {
        topic: t,
        audience: audience.trim(),
        // Recording in eternity — no target, ever.
        target_length_seconds: null,
        domain_vocabulary: [],
        slides: presentationRef ? clampSlides(slides) : nonEmptySlides(slides),
        presentationRef,
      },
      true
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1">
        <div className="mb-5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Topic
          </p>
          <h2 className="mt-1.5 text-[22px] font-semibold leading-snug text-foreground">
            What are you speaking on?
          </h2>
        </div>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="e.g. my Q3 results pitch"
          className={SETUP_INPUT_CLS}
          autoFocus
        />

        {/* The deck. Not a step any more — it sits under the topic on the same
            screen, so attaching one costs a tap rather than a screen, and
            skipping it costs nothing at all. */}
        {hideDeck ? null : (
          <div className="mt-7">
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Slides
            </p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              Optional, and it changes the result: with slides, every word is
              matched to the slide that was on screen when you said it.
            </p>
            <div className="mt-3">
              <PresentationInput
                slides={slides}
                presentationRef={presentationRef}
                onChange={(s, ref) => {
                  setSlides(s);
                  setPresentationRef(ref);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA — the tap starts the mic synchronously via onSubmit. */}
      <div className="mt-auto pt-6">
        <Button
          type="button"
          onClick={submit}
          disabled={!topicReady}
          className="w-full rounded-full"
        >
          Start recording
        </Button>
        {/* The nudge that replaces the wizard: said once here, before the
            first take, then again by the counter during recording and by the
            readout after. Never a gate. */}
        <p className="mt-3 text-center text-[12px] leading-relaxed text-muted-foreground">
          {THREE_TAKE_NUDGE}
        </p>
      </div>
    </div>
  );
}
