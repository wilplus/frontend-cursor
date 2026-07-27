"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import PresentationInput from "./PresentationInput";
import ContextDocumentInput from "./ContextDocumentInput";
import { type LabSessionContext } from "./LabOverlay";
import { type ExploreArcDeck } from "@/lib/willab/exploreArc";
import {
  clampSlides,
  initialSlides,
  nonEmptySlides,
  type PresentationSlide,
} from "./presentation";
import { fetchRecordingConfig } from "@/services/api/recordingConfig";

/* -------------------------------------------------------------------------- */
/*  RecordingSetup (④) — the recording setup as a one-question-per-screen flow  */
/*                                                                            */
/*  Replaces the single SessionContextForm. Five steps: topic (required),      */
/*  audience, length, slides, and a strategic-context note. Only topic gates    */
/*  advancing; everything else is optional. The final "Start recording" tap IS  */
/*  the user gesture getUserMedia needs, so it must call onSubmit synchronously  */
/*  (the parent starts the mic in the same click) — no async work sits between   */
/*  the tap and onSubmit.                                                       */
/*                                                                            */
/*  App tokens on white only (no amber, no hard-coded neutrals); orange stays   */
/*  reserved for live-action signals, so selections use the neutral foreground.  */
/* -------------------------------------------------------------------------- */

const LENGTH_PRESETS = [
  { label: "1 min", sec: 60 },
  { label: "2 min", sec: 120 },
  { label: "3 min", sec: 180 },
  { label: "5 min", sec: 300 },
  { label: "30 min", sec: 1800 },
  { label: "45 min", sec: 2700 },
  { label: "60 min", sec: 3600 },
] as const;

/** The 3-take nudge (founder 2026-07-27).
 *
 *  Reused VERBATIM from the readout, where it is already signed off, rather
 *  than written fresh — the places a user is told this must not say it two
 *  different ways, and reuse means no new copy to sign off. The live
 *  "Take N of 3" counter during recording is the third leg of the same nudge.
 *
 *  It sits under the LAST step's CTA only: said once, immediately before the
 *  take, where "record another after this one" is a thing the user can act on.
 *  Repeating it on all five steps would make it wallpaper. */
export const THREE_TAKE_NUDGE =
  "Your ideal text gets sharper with more takes. Three is where it really lands.";

const SETUP_INPUT_CLS =
  "w-full h-12 rounded-xl border border-border bg-background px-4 text-[15px] placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition";

type StepKey = "topic" | "audience" | "length" | "slides" | "context";

/** One question per screen: a small eyebrow, the question, an optional helper. */
function StepHead({
  eyebrow,
  question,
  helper,
}: {
  eyebrow: string;
  question: string;
  helper?: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 text-[22px] font-semibold leading-snug text-foreground">
        {question}
      </h2>
      {helper ? (
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export default function RecordingSetup({
  contextArcId,
  preloadDeck,
  hideDeck = false,
  onSubmit,
  onCancel,
}: {
  /** Arc this setup records into, or null (new project / detached upload). Gates
   *  the real context-document upload in step 5 (which needs an existing arc). */
  contextArcId: string | null;
  /** Continuing a known deck — pre-fill topic / audience / length / slides. */
  preloadDeck: ExploreArcDeck | null;
  /** Skip the slide step (deckless-only flows, e.g. a staged footer upload). */
  hideDeck?: boolean;
  onSubmit: (ctx: LabSessionContext, explore: boolean) => void;
  /** FE-6 — leave the setup flow. Present → the ✕ is drawn on the step
   *  indicator row, on EVERY step. Absent → no ✕ (the host has its own way
   *  out and a second one would just be two crosses on one screen). */
  onCancel?: () => void;
}) {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [lengthSec, setLengthSec] = useState<number | null>(null);
  const [slides, setSlides] = useState<PresentationSlide[]>(initialSlides());
  const [presentationRef, setPresentationRef] = useState<string | null>(null);
  const [strategicContext, setStrategicContext] = useState("");
  const [step, setStep] = useState(0);
  // FE-5 — the threshold, read from the server. Never a literal: the number is
  // served precisely so it can move without a deploy.
  const [cautionSec, setCautionSec] = useState<number | null>(null);
  // The caution is shown ONCE PER SETUP FLOW, not on every re-tap of a length
  // chip — it is advice, and advice that repeats becomes noise to click past.
  const [cautionOpen, setCautionOpen] = useState(false);
  const cautionShownRef = useRef(false);

  useEffect(() => {
    let active = true;
    void fetchRecordingConfig().then((c) => {
      if (active) setCautionSec(c.longTakeCautionSec);
    });
    return () => {
      active = false;
    };
  }, []);

  const steps: StepKey[] = hideDeck
    ? ["topic", "audience", "length", "context"]
    : ["topic", "audience", "length", "slides", "context"];
  const current = steps[step];
  const isLast = step === steps.length - 1;

  // Pre-fill once from the arc's deck (record-another-take into a known deck).
  const didPreloadRef = useRef(false);
  useEffect(() => {
    if (didPreloadRef.current || !preloadDeck) return;
    didPreloadRef.current = true;
    if (preloadDeck.topic) setTopic(preloadDeck.topic);
    // The project's audience carries into the continued take's setup.
    if (preloadDeck.audience) setAudience(preloadDeck.audience);
    if (preloadDeck.slides.length > 0) setSlides(preloadDeck.slides);
    setPresentationRef(preloadDeck.presentationRef);
    // Restore the set length so the next take's timer counts down from it.
    if (preloadDeck.targetLengthSeconds != null) {
      setLengthSec(preloadDeck.targetLengthSeconds);
    }
  }, [preloadDeck]);

  // Length auto-advances shortly after a tap (Typeform feel). The guard pins the
  // advance to the length step so a late timer can never over-step the flow.
  const advanceTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    },
    []
  );
  /** FE-5 — a long take earns a soft caution: at or ABOVE the served threshold
   *  (>=, so 10 minutes itself triggers it), and "No limit" triggers it too —
   *  an unbounded take is the longest take there is. Nothing is enforced
   *  server-side; a long take records, uploads and processes exactly as
   *  before. This is advice. */
  function isLongTake(sec: number | null): boolean {
    if (cautionSec === null) return false; // threshold unknown → never guess
    return sec === null || sec >= cautionSec;
  }

  function pickLength(sec: number | null) {
    setLengthSec(sec);
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    if (isLongTake(sec) && !cautionShownRef.current) {
      cautionShownRef.current = true;
      setCautionOpen(true);
      return; // the modal owns the step until it is answered
    }
    const lengthIdx = steps.indexOf("length");
    advanceTimer.current = window.setTimeout(() => {
      setStep((s) =>
        s === lengthIdx && lengthIdx < steps.length - 1 ? s + 1 : s
      );
    }, 180);
  }

  /** The caution's primary action: proceed with the long take, exactly as if
   *  the chip had auto-advanced. Never a block, never a downgrade. */
  function proceedFromCaution() {
    setCautionOpen(false);
    const lengthIdx = steps.indexOf("length");
    setStep((s) => (s === lengthIdx && lengthIdx < steps.length - 1 ? s + 1 : s));
  }



  const hasSlides = !!presentationRef || nonEmptySlides(slides).length > 0;
  const topicReady = topic.trim().length > 0;

  function submit() {
    const t = topic.trim();
    if (!t) {
      setStep(steps.indexOf("topic"));
      return;
    }
    onSubmit(
      {
        topic: t,
        audience: audience.trim(),
        target_length_seconds: lengthSec,
        domain_vocabulary: [],
        slides: presentationRef ? clampSlides(slides) : nonEmptySlides(slides),
        presentationRef,
        strategicContext: strategicContext.trim() || undefined,
      },
      true
    );
  }

  function goNext() {
    if (current === "topic" && !topicReady) return;
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    if (isLast) submit();
    else setStep((s) => Math.min(s + 1, steps.length - 1));
  }
  function goBack() {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    setStep((s) => Math.max(s - 1, 0));
  }

  // Enter advances from the single-line text steps (never from the textarea,
  // where Enter must insert a newline).
  function onEnterAdvance(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      goNext();
    }
  }

  // New-project fallback for the brief: no arc to attach to yet, so fold the
  // chosen file's name into the context note (the real upload lands next take).
  function appendBrief(filename: string) {
    setStrategicContext((prev) => {
      const marker = `[Attached: ${filename}]`;
      if (prev.includes(marker)) return prev;
      return prev ? `${prev}\n\n${marker}` : marker;
    });
  }

  const primaryLabel = isLast
    ? "Start recording"
    : current === "slides" && !hasSlides
      ? "Skip for now"
      : "Next";

  return (
    <div className="flex flex-1 flex-col">
      {/* Progress + Back */}
      <div className="mb-6 flex items-center gap-3">
        <div className="w-16">
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex h-8 items-center rounded-full px-2 text-[13px] text-muted-foreground transition hover:text-foreground"
            >
              ← Back
            </button>
          ) : null}
        </div>
        <div className="flex flex-1 items-center justify-center gap-1.5">
          {steps.map((k, i) => (
            <span
              key={k}
              className={cn(
                "rounded-full transition-all",
                // FE-6 — the current step stays legible at a glance: it is both
                // longer and taller than the rest, not just longer.
                i === step
                  ? "h-2 w-6 bg-foreground"
                  : i < step
                    ? "h-1.5 w-1.5 bg-foreground/40"
                    : "h-1.5 w-1.5 bg-muted-foreground/20"
              )}
            />
          ))}
        </div>
        {/* FE-6 (founder 2026-07-27) — the "cross" on the "progress bar" is a
            CANCEL button on the step indicator, not a position marker and not
            a playhead: there is no moving playhead in this flow. It sits in
            the wizard's top-right reference position on EVERY step — the
            inconsistency of having it on some and not others IS the story.
            A real 44px touch target inside a 16-unit slot that mirrors the
            Back button's, so it can never overlap the dots at any width.

            Founder 2026-07-27 — it leaves IMMEDIATELY. The confirm-before-
            discard this shipped with is deleted along with its copy. */}
        <div className="flex w-16 justify-end">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel setup"
              className="-mr-2.5 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {/* Step body */}
      <div className="flex-1">
        {current === "topic" && (
          <div>
            <StepHead eyebrow="Topic" question="What are you speaking on?" />
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={onEnterAdvance}
              placeholder="e.g. my Q3 results pitch"
              className={SETUP_INPUT_CLS}
              autoFocus
            />
          </div>
        )}

        {current === "audience" && (
          <div>
            <StepHead
              eyebrow="Audience"
              question="Who's the audience?"
              helper="Naming the audience anchors the tone: leadership team, students, investors, a single person."
            />
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              onKeyDown={onEnterAdvance}
              placeholder="e.g. the leadership team"
              className={SETUP_INPUT_CLS}
              autoFocus
            />
          </div>
        )}

        {current === "length" && (
          <div>
            <StepHead eyebrow="Length" question="How long should it run?" />
            <div className="flex flex-wrap gap-2">
              {LENGTH_PRESETS.map((p) => {
                const active = lengthSec === p.sec;
                return (
                  <button
                    key={p.sec}
                    type="button"
                    onClick={() => pickLength(p.sec)}
                    aria-pressed={active}
                    className={cn(
                      "h-10 rounded-full border px-4 text-[14px] transition active:scale-[0.98]",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:border-foreground/40"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => pickLength(null)}
              className="mt-4 text-[13px] text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
            >
              No limit
            </button>
          </div>
        )}

        {current === "slides" && (
          <div>
            <StepHead
              eyebrow="Slides"
              question="Have slides to go with it?"
              helper="Adding slides makes the ideal text dramatically better. It grounds the coach in exactly what your audience sees."
            />
            <PresentationInput
              slides={slides}
              presentationRef={presentationRef}
              onChange={(s, ref) => {
                setSlides(s);
                setPresentationRef(ref);
              }}
            />
          </div>
        )}

        {current === "context" && (
          <div>
            <StepHead
              eyebrow="Context"
              question="Anything your coach should know?"
              helper="A line on the stakes, the setting, or what you want to nail. Your coach uses it to sharpen the ideal text."
            />
            <div className="mb-3 rounded-xl bg-muted px-3 py-2 text-[13px] text-muted-foreground">
              Optional, but this is where it brings most value.
            </div>
            <textarea
              value={strategicContext}
              onChange={(e) => setStrategicContext(e.target.value)}
              rows={7}
              placeholder="e.g. This is my first board meeting and I tend to rush when I'm nervous."
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-[15px] leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition"
            />
            {/* Attach a document for background context. A live project uses the
                real context-document upload (parsed, never quoted back); a
                brand-new project has no arc to attach to yet, so we just note the
                filename in the context text and the real upload lands next take. */}
            <div className="mt-3">
              {contextArcId ? (
                <ContextDocumentInput arcId={contextArcId} />
              ) : (
                <BriefAttach onPick={appendBrief} />
              )}
            </div>
          </div>
        )}
      </div>

      {cautionOpen ? (
        <LongTakeCaution
          onProceed={proceedFromCaution}
          onBack={() => setCautionOpen(false)}
        />
      ) : null}

      {/* Footer CTA — the final tap starts the mic synchronously via onSubmit. */}
      <div className="mt-auto pt-6">
        <Button
          type="button"
          onClick={goNext}
          disabled={current === "topic" && !topicReady}
          className="w-full rounded-full"
        >
          {primaryLabel}
        </Button>
        {isLast ? (
          <p className="mt-3 text-center text-[12px] leading-relaxed text-muted-foreground">
            {THREE_TAKE_NUDGE}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** FE-5 — the long-take caution. SOFT, ALWAYS: the primary action proceeds
 *  with the long take, there is no forced downgrade, and Next is never
 *  disabled. Dismissible with Esc, the backdrop, or the ✕. Nothing server-side
 *  enforces any of this — a long take records, uploads and processes exactly
 *  as before. The modal is advice.
 *
 *  The copy is founder-authored and signed off; render it VERBATIM. */
const LONG_TAKE_COPY =
  "Preparing for a long workshop? It's often better to practice just the " +
  "beginning and the ending. Consider recording a few 2-3 minute takes to " +
  "practice those vulnerable moments instead of focusing on a long speech. " +
  "Note: Analysis of long speeches might take considerably longer.";

function LongTakeCaution({
  onProceed,
  onBack,
}: {
  onProceed: () => void;
  onBack: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onBack]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onBack}
        className="absolute inset-0 bg-foreground/20"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="About long takes"
        className="relative z-10 m-3 w-full max-w-md rounded-3xl border border-border bg-background p-5 shadow-lg"
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onBack}
            aria-label="Dismiss"
            className="-mr-1.5 -mt-1.5 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <p className="text-[15px] leading-relaxed text-foreground">
          {LONG_TAKE_COPY}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button type="button" onClick={onProceed} className="w-full rounded-full">
            Continue with this length
          </Button>
          <button
            type="button"
            onClick={onBack}
            className="h-10 rounded-full text-[14px] text-muted-foreground transition hover:text-foreground"
          >
            Pick a different length
          </button>
        </div>
      </div>
    </div>
  );
}

/** Step-5 brief attach for a brand-new project (no arc yet): folds the chosen
 *  file's name into the context note as a marker. Once the project exists the
 *  real ContextDocumentInput (a parsed, background-only upload) takes over. */
function BriefAttach({ onPick }: { onPick: (filename: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // allow re-selecting the same file
          if (f) onPick(f.name);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-[14px] transition hover:bg-muted active:scale-[0.98]"
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
        Attach a brief
      </button>
    </>
  );
}
