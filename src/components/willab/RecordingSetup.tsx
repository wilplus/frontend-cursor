"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepHead, WizardCancel, WizardChip, WizardProgress } from "@/components/ui/wizard";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { uiText, type UiLocale } from "@/lib/uiLocale";
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
import RecordPriceNote from "@/components/tokens/RecordPriceNote";
import {
  deleteSetupDraft,
  readActiveSetupDraft,
  saveSetupDraft,
} from "@/lib/willab/setupDraft";
import { recordingText } from "./recordingCopy";

/* -------------------------------------------------------------------------- */
/*  RecordingSetup (④) — the recording setup as a one-question-per-screen flow  */
/*                                                                            */
/*  Replaces the single SessionContextForm. Three visible steps: topic          */
/*  (required), length and slides. Only topic gates                             */
/*  advancing; everything else is optional. The final "Start recording" tap IS  */
/*  the user gesture getUserMedia needs, so it must call onSubmit synchronously  */
/*  (the parent starts the mic in the same click) — no async work sits between   */
/*  the tap and onSubmit.                                                       */
/*                                                                            */
/*  App tokens on white only (no amber, no hard-coded neutrals); orange stays   */
/*  reserved for live-action signals, so selections use the neutral foreground.  */
/* -------------------------------------------------------------------------- */

const LENGTH_PRESETS = [
  { label: "3 min", sec: 180 },
  { label: "5 min", sec: 300 },
  { label: "10 min", sec: 600 },
  { label: "30 min", sec: 1800 },
  { label: "60 min", sec: 3600 },
] as const;

const SETUP_INPUT_CLS =
  "w-full h-12 rounded-xl border border-border bg-background px-4 text-[15px] placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition";

type LengthChoice = "preset" | "other" | "none" | null;

function presentationMinutesToSeconds(value: string): number | null {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 && minutes <= 120
    ? Math.round(minutes * 60)
    : null;
}

function isLengthSelectionReady(
  choice: LengthChoice,
  lengthSec: number | null,
): boolean {
  return choice !== null && (choice !== "other" || lengthSec !== null);
}

function recordingSetupPrimaryLabel(
  current: StepKey,
  hasSlides: boolean,
  isLast: boolean,
  locale: UiLocale,
): string {
  if (current === "slides" && !hasSlides) return uiText(locale, "setupSkipForNow");
  return isLast
    ? uiText(locale, "setupStartRecording")
    : uiText(locale, "setupNext");
}

function recordingSetupPrimaryDisabled(
  current: StepKey,
  topicReady: boolean,
  lengthReady: boolean,
): boolean {
  return (
    (current === "topic" && !topicReady) ||
    (current === "length" && !lengthReady)
  );
}

// "goal" ("What should this presentation achieve?") was removed 2026-09-15 on
// founder instruction: it and "What should the audience do next?" were asking
// the same question twice, one step apart, and people answered it twice.
type StepKey =
  | "topic"
  | "audience"
  | "call_to_action"
  | "length"
  | "slides"
  | "context";

/** The setup's visible steps. A staged footer upload has no slide step.
 *  The feelings check reads it too, to count itself in the same dots. */
export function setupSteps(hideDeck: boolean): StepKey[] {
  // "audience", "call_to_action" and "context" are hidden, not deleted
  // (founder 2026-10-12): their state, draft fields and submit wiring stay, so
  // a continued take still carries the project's audience from preloadDeck.
  return hideDeck ? ["topic", "length"] : ["topic", "length", "slides"];
}

export default function RecordingSetup({
  contextArcId,
  preloadDeck,
  hideDeck = false,
  draftOwnerId,
  leadSteps = 0,
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
  /** Setup drafts (founder 2026-09-25) — the account whose ACTIVE draft this
   *  setup restores from and writes to. Undefined = never draft. A staged
   *  upload (hideDeck) or a deck-prefilled continuation never drafts either,
   *  and only the new-project entries set an active draft, so an owner with
   *  no active draft writes nothing. */
  draftOwnerId?: string | null;
  /** Steps drawn before this form in the same dots: 1 when "How do you
   *  feel?" was asked just before (backend N272), so the topic is the
   *  second of four. Back never leaves this form. */
  leadSteps?: number;
  onSubmit: (ctx: LabSessionContext, explore: boolean) => void;
  /** FE-6 — leave the setup flow. Present → the ✕ is drawn on the step
   *  indicator row, on EVERY step. Absent → no ✕ (the host has its own way
   *  out and a second one would just be two crosses on one screen). */
  onCancel?: () => void;
}) {
  const locale = useUiLocale();
  const steps = setupSteps(hideDeck);
  // Read once, at mount: the draft being resumed (or the fresh slot "Start a
  // new project" opened). Later renders never re-read it — this form owns it.
  const [active] = useState(() =>
    draftOwnerId === undefined || hideDeck || preloadDeck
      ? null
      : readActiveSetupDraft(draftOwnerId)
  );
  const draft = active?.draft ?? null;
  const [topic, setTopic] = useState(draft?.topic ?? "");
  const [audience, setAudience] = useState(draft?.audience ?? "");
  const [desiredCallToAction, setDesiredCallToAction] = useState(
    draft?.desiredCallToAction ?? ""
  );
  const [lengthSec, setLengthSec] = useState<number | null>(
    draft?.lengthSec ?? null
  );
  const [lengthChoice, setLengthChoice] = useState<LengthChoice>(() => {
    if (draft?.lengthChoice) return draft.lengthChoice;
    if (draft?.lengthSec == null) return null;
    return LENGTH_PRESETS.some((preset) => preset.sec === draft.lengthSec)
      ? "preset"
      : "other";
  });
  const [otherMinutes, setOtherMinutes] = useState(() =>
    draft?.lengthSec &&
    !LENGTH_PRESETS.some((preset) => preset.sec === draft.lengthSec)
      ? String(Math.round(draft.lengthSec / 60))
      : ""
  );
  const [slides, setSlides] = useState<PresentationSlide[]>(() =>
    draft && draft.slides.length > 0 ? draft.slides : initialSlides()
  );
  const [presentationRef, setPresentationRef] = useState<string | null>(
    draft?.presentationRef ?? null
  );
  const [strategicContext, setStrategicContext] = useState(
    draft?.strategicContext ?? ""
  );
  const [contextDocument, setContextDocument] = useState<File | null>(null);
  // A resumed draft's step is clamped so it can never index past the flow.
  const [step, setStep] = useState(() =>
    Math.min(draft?.step ?? 0, steps.length - 1)
  );
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
    // Restore the whole-presentation target. Recording chunks have their own
    // fixed cap and never inherit this number.
    if (preloadDeck.targetLengthSeconds != null) {
      setLengthSec(preloadDeck.targetLengthSeconds);
      const isPreset = LENGTH_PRESETS.some(
        (preset) => preset.sec === preloadDeck.targetLengthSeconds,
      );
      setLengthChoice(isPreset ? "preset" : "other");
      if (!isPreset) {
        setOtherMinutes(
          String(Math.round(preloadDeck.targetLengthSeconds / 60)),
        );
      }
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
  function pickLength(sec: number | null, choice: "preset" | "none") {
    setLengthSec(sec);
    setLengthChoice(choice);
    setOtherMinutes("");
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    const lengthIdx = steps.indexOf("length");
    advanceTimer.current = window.setTimeout(() => {
      setStep((s) =>
        s === lengthIdx && lengthIdx < steps.length - 1 ? s + 1 : s
      );
    }, 180);
  }

  // Every answer lands in the draft as it is typed, so any interruption —
  // the ✕, a closed tab, a crash — leaves the setup resumable from the picker.
  // Nothing is stored until at least one question holds an answer.
  const draftId = active?.id ?? null;
  useEffect(() => {
    if (draftId === null || draftOwnerId === undefined) return;
    saveSetupDraft(draftOwnerId, draftId, {
      step,
      topic,
      audience,
      desiredCallToAction,
      lengthSec,
      lengthChoice,
      slides,
      presentationRef,
      strategicContext,
    });
  }, [
    draftId,
    draftOwnerId,
    step,
    topic,
    audience,
    desiredCallToAction,
    lengthSec,
    lengthChoice,
    slides,
    presentationRef,
    strategicContext,
  ]);

  const hasSlides = !!presentationRef || nonEmptySlides(slides).length > 0;
  const lengthReady = isLengthSelectionReady(lengthChoice, lengthSec);

  // A project title is display copy, never identity. Same-named projects are
  // valid; authenticated owner + immutable arc UUID keep their data separate.
  const topicReady = topic.trim().length > 0;

  function submit() {
    const t = topic.trim();
    if (!t) {
      setStep(steps.indexOf("topic"));
      return;
    }
    const intentContext = [
      desiredCallToAction.trim()
        ? `Desired call to action: ${desiredCallToAction.trim()}`
        : null,
      strategicContext.trim()
        ? `Additional context: ${strategicContext.trim()}`
        : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");
    // Take 1 is starting: the draft becomes a real project and leaves the list.
    if (draftId !== null && draftOwnerId !== undefined) {
      deleteSetupDraft(draftOwnerId, draftId);
    }
    onSubmit(
      {
        topic: t,
        audience: audience.trim(),
        target_length_seconds: lengthSec,
        domain_vocabulary: [],
        slides: presentationRef ? clampSlides(slides) : nonEmptySlides(slides),
        presentationRef,
        strategicContext: intentContext || undefined,
        contextDocument: contextDocument || undefined,
      },
      true
    );
  }

  function goNext() {
    if (current === "topic" && !topicReady) return;
    if (current === "length" && !lengthReady) return;
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

  // The slides step with none added says "Skip for now", the last step
  // included, where it starts the recording (backend N449 item 3).
  const primaryLabel = recordingSetupPrimaryLabel(current, hasSlides, isLast, locale);

  return (
    <div className="flex flex-1 flex-col">
      {/* Progress + Back + the cancel ✕, from the shared wizard chrome — the
          Life Panel's setup mounts the same components, so the product's two
          onboarding flows cannot drift apart again. */}
      <WizardProgress
        count={leadSteps + steps.length}
        current={leadSteps + step}
        onBack={step > 0 ? goBack : undefined}
        backLabel={recordingText("back", locale)}
        trailing={
          // FE-6 — the "cross" on the "progress bar" is a CANCEL button on the
          // step indicator, not a position marker and not a playhead. It sits
          // in the top-right reference position on EVERY step; the
          // inconsistency of having it on some and not others IS the story.
          // A real 44px target, and the slot mirrors Back's width so it can
          // never overlap the dots. It leaves IMMEDIATELY — the
          // confirm-before-discard was deleted with its copy.
          onCancel ? (
            <WizardCancel onClick={onCancel} ariaLabel={uiText(locale, "setupCancel")} />
          ) : null
        }
      />

      {/* Step body */}
      <div className="flex-1">
        {current === "topic" && (
          <div>
            <StepHead icon={Mic} question={uiText(locale, "setupTopicQuestion")} />
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={onEnterAdvance}
              placeholder={uiText(locale, "setupTopicPlaceholder")}
              className={SETUP_INPUT_CLS}
              autoFocus
            />
          </div>
        )}

        {current === "audience" && (
          <div>
            <StepHead icon={Mic} question="Who's the audience?" />
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

        {current === "call_to_action" && (
          <div>
            <StepHead
              icon={Mic}
              question="What do you want your audience to do as a result of your presentation?"
            />
            <input
              value={desiredCallToAction}
              onChange={(e) => setDesiredCallToAction(e.target.value)}
              onKeyDown={onEnterAdvance}
              placeholder="e.g. approve the pilot today"
              maxLength={400}
              className={SETUP_INPUT_CLS}
              autoFocus
            />
          </div>
        )}

        {current === "length" && (
          <LengthStep
            choice={lengthChoice}
            lengthSec={lengthSec}
            otherMinutes={otherMinutes}
            onPreset={(seconds) => pickLength(seconds, "preset")}
            onOther={() => {
              if (advanceTimer.current) {
                window.clearTimeout(advanceTimer.current);
              }
              setLengthChoice("other");
              setLengthSec(null);
            }}
            onOtherMinutes={(value) => {
              setOtherMinutes(value);
              setLengthSec(presentationMinutesToSeconds(value));
            }}
            onNoLimit={() => pickLength(null, "none")}
            locale={locale}
          />
        )}

        {current === "slides" && (
          <div>
            <StepHead
              icon={Mic}
              question={uiText(locale, "setupSlidesQuestion")}
            />
            <PresentationInput
              locale={locale}
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
              icon={Mic}
              question="Additional sources to help us understand what your presentation is about"
              helper="You can upload here the core written logic and any other resources you might have."
            />
            <textarea
              value={strategicContext}
              onChange={(e) => setStrategicContext(e.target.value)}
              rows={7}
              maxLength={1000}
              placeholder="e.g. This is my first board meeting and I tend to rush when I'm nervous."
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-[15px] leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition"
            />
            {/* Attach a document for background context. A live project uses the
                dedicated arc endpoint. For a brand-new project the File rides
                the first take and is persisted as soon as its new arc exists. */}
            <div className="mt-3">
              {contextArcId ? (
                <ContextDocumentInput arcId={contextArcId} />
              ) : (
                <BriefAttach
                  file={contextDocument}
                  onPick={setContextDocument}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA — the final tap starts the mic synchronously via onSubmit. */}
      <div className="mt-auto pt-6">
        <Button
          type="button"
          onClick={goNext}
          disabled={recordingSetupPrimaryDisabled(
            current,
            topicReady,
            lengthReady,
          )}
          className="w-full rounded-full"
        >
          {primaryLabel}
        </Button>
        {/* Price BEFORE the take, on the last step only: said once,
            immediately before the thing it describes. Renders nothing unless
            token pricing is live, and never disables the CTA above it. The
            3-take nudge that sat here was removed (founder 2026-10-12). */}
        {isLast ? <RecordPriceNote locale={locale} /> : null}
      </div>
    </div>
  );
}

function LengthStep({
  choice,
  lengthSec,
  otherMinutes,
  onPreset,
  onOther,
  onOtherMinutes,
  onNoLimit,
  locale,
}: {
  choice: LengthChoice;
  lengthSec: number | null;
  otherMinutes: string;
  onPreset: (seconds: number) => void;
  onOther: () => void;
  onOtherMinutes: (value: string) => void;
  onNoLimit: () => void;
  locale: UiLocale;
}) {
  return (
    <div>
      <StepHead icon={Mic} question={uiText(locale, "setupTimeLimitQuestion")} />
      <div className="flex flex-wrap gap-2">
        {LENGTH_PRESETS.map((preset) => (
          <WizardChip
            key={preset.sec}
            active={choice === "preset" && lengthSec === preset.sec}
            onClick={() => onPreset(preset.sec)}
          >
            {preset.label}
          </WizardChip>
        ))}
        <WizardChip active={choice === "other"} onClick={onOther}>
          {uiText(locale, "setupOther")}
        </WizardChip>
      </div>
      {choice === "other" ? (
        <div className="mt-4 max-w-[220px]">
          <label
            htmlFor="presentation-limit-minutes"
            className="mb-1.5 block text-[13px] text-muted-foreground"
          >
            {uiText(locale, "setupMinutes")}
          </label>
          <input
            id="presentation-limit-minutes"
            type="number"
            min={1}
            max={120}
            inputMode="numeric"
            value={otherMinutes}
            onChange={(event) => onOtherMinutes(event.target.value)}
            className={SETUP_INPUT_CLS}
            autoFocus
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={onNoLimit}
        className="mt-4 text-[13px] text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
      >
        {uiText(locale, "setupNoTimeLimit")}
      </button>
    </div>
  );
}

/** Step-5 brief attach for a brand-new project (no arc yet). The File stays in
 *  this setup only and is sent with Take 1; it is never reduced to a filename
 *  marker that the feedback engine cannot read. */
function BriefAttach({
  file,
  onPick,
}: {
  file: File | null;
  onPick: (file: File | null) => void;
}) {
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
          if (f) onPick(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-[14px] transition hover:bg-muted active:scale-[0.98]"
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
        {file ? "Replace brief" : "Attach a brief"}
      </button>
      {file ? (
        <div className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className="min-w-0 truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => onPick(null)}
            className="shrink-0 underline underline-offset-2 transition hover:text-foreground"
          >
            Remove
          </button>
        </div>
      ) : null}
    </>
  );
}

// Founder-Approved: whole-presentation time limit and fixed five-minute practice chunks, 2026-11-16.
