"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  acceptAuthorization,
  recordAiNoticeRendered,
  type PolicyDocument,
  type ProcessingPolicy,
} from "@/services/api/processingAuthorization";
import {
  STEP_ORDER,
  allDocumentsSeen,
  canSubmit,
  countryChoices,
  nextStep,
  optionalPurposesFor,
  previousStep,
  type Step,
} from "@/lib/legal/acceptanceSteps";

/* -------------------------------------------------------------------------- */
/*  The Phase-1 acceptance screens (Task 5).                                   */
/*                                                                            */
/*  The last missing half of the boundary. The BFF lane, the client and the    */
/*  RPCs have all existed with no surface that could reach them, which is why  */
/*  no user has ever produced a receipt and why `enforce` would refuse every   */
/*  recording.                                                                 */
/*                                                                            */
/*  EVERY WORD ON THESE SCREENS COMES FROM THE POLICY RECORD. The component    */
/*  holds no legal copy, no country list, no age. It renders `agreement_copy`  */
/*  and the three documents as the exact stored bytes — whitespace preserved,  */
/*  never markdown, never re-wrapped — because those bytes are what the hashes */
/*  cover and what a user later proves they agreed to. A paraphrase here would */
/*  make the receipt evidence of words nobody was shown.                       */
/*                                                                            */
/*  The strings this file DOES own are navigation and scaffolding — "Back",    */
/*  "Continue", the step labels. Anything that states a fact about processing  */
/*  belongs in the policy copy, under founder sign-off (LIVE LOOP fence).      */
/* -------------------------------------------------------------------------- */

const CLIENT_VERSION = "phase1-acceptance-web-v1";

/** One key per acceptance ATTEMPT, held across retries of that attempt — and
 *  deliberately NOT across a stale refetch, which is agreement to different
 *  bytes and must not replay the earlier receipt. */
function newAttemptKey(): string {
  return crypto.randomUUID();
}

function readLocale(): string {
  if (typeof navigator === "undefined") return "en";
  return navigator.language || "en";
}

/* ---------------------------------------------------------------- pieces -- */

/** The breathing voice mark from WelcomeConsent, at document scale.
 *  Decorative: the rings and dots carry no state and are aria-hidden. */
function VoiceMark({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`relative flex items-center justify-center ${
        small ? "mb-5 h-20 w-20" : "mb-10 h-40 w-40"
      }`}
      aria-hidden="true"
    >
      <span className="breath-ring absolute inset-0 rounded-full border border-foreground/10" />
      <span
        className={`breath-ring absolute rounded-full border border-foreground/15 ${
          small ? "inset-1.5" : "inset-3"
        }`}
        style={{ animationDelay: "0.6s" }}
      />
      <span
        className={`breath-ring absolute rounded-full border border-primary/30 ${
          small ? "inset-3" : "inset-6"
        }`}
        style={{ animationDelay: "1.2s" }}
      />
      <svg
        width={small ? 32 : 56}
        height={small ? 32 : 56}
        viewBox="0 0 56 56"
        aria-hidden="true"
      >
        <circle className="welcome-voice-dot" cx="12" cy="28" r="4" fill="hsl(var(--foreground))" />
        <circle className="welcome-voice-dot" cx="28" cy="28" r="6" fill="hsl(var(--foreground))" />
        <circle className="welcome-voice-dot" cx="44" cy="28" r="4" fill="hsl(var(--foreground))" />
      </svg>
    </div>
  );
}

/** The one primary action. Matches WelcomeConsent's CTA exactly, including the
 *  orange dot — which is the whole of `primary` on these screens, because the
 *  restraint rule in globals.css reserves it for live-action signals. */
function Cta({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-7 text-[14px] font-medium text-background transition hover:bg-foreground/90 active:scale-[0.98] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-foreground"
    >
      {children}
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full bg-primary transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}

/** Secondary actions stack under the primary one with no background and no
 *  stroke: a refusal that looks like a disabled control is not a free choice
 *  (Art 7(4)), and a bordered one competes with the action it sits under. */
function Secondary({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 h-11 px-2 text-[14px] text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </button>
  );
}

/** How long the chosen country stays visible before the step advances.
 *
 *  Founder 2026-09-23: selecting a country should carry you forward on its
 *  own, Typeform-style, instead of asking for a second tap on "Continue".
 *
 *  THE DELAY IS NOT DECORATION. The radio has to visibly fill before the step
 *  changes, or the tap reads as "the app jumped" rather than "my answer
 *  registered" — and on a legal screen the second reading is the one that
 *  matters. Short enough not to feel like waiting, long enough to be seen.
 *
 *  ONLY THE COUNTRY STEP DOES THIS, AND THAT IS THE POINT. The two
 *  attestations on `confirm` are the agreement itself. Consent has to stay a
 *  deliberate second action: auto-advancing off a tick box is precisely how a
 *  mis-tap becomes a recorded agreement, and a receipt that names bytes the
 *  user never meant to accept is worse than an extra tap. */
const COUNTRY_ADVANCE_MS = 260;

/** A selectable card. One shape for the countries and for the two
 *  attestations, because they are the same kind of question. */
function Choice({
  selected,
  onClick,
  indicator,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  indicator: "radio" | "check";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted ${
        selected ? "border-foreground" : "border-border"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center border-[1.5px] transition-colors ${
          indicator === "radio" ? "rounded-full" : "rounded-[5px]"
        } ${
          selected
            ? "border-foreground bg-foreground"
            : "border-muted-foreground/60 bg-background"
        }`}
      >
        {selected && indicator === "radio" ? (
          <span className="h-2 w-2 rounded-full bg-background" />
        ) : null}
        {selected && indicator === "check" ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6.2 4.6 8.8 10 3.4"
              stroke="hsl(var(--background))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

/** A stored document, rendered as the exact bytes that were hashed.
 *  No markdown, no per-line styling — see PublishedPolicyText for why. */
function DocumentPane({
  title,
  document,
  onDone,
  onBack,
}: {
  title: string;
  document: PolicyDocument;
  onDone: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden px-6 pb-6 pt-8">
      <div className="shrink-0 border-b border-border pb-4">
        <h1 className="text-[24px] font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Version {document.version}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap py-5 text-[15px] leading-[1.7] text-foreground/90">
        {document.copy}
      </div>
      <div className="flex shrink-0 flex-col items-center pt-4">
        <Cta onClick={onDone}>Done reading</Cta>
        <Secondary onClick={onBack}>Back</Secondary>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ flow -- */

export default function Phase1AcceptanceFlow({
  policy,
  onAccepted,
  onStale,
}: {
  policy: ProcessingPolicy;
  /** A receipt now exists for this principal. The gate re-renders its child. */
  onAccepted: () => void;
  /** The policy moved under us. The gate must refetch and re-present; we must
   *  not resubmit the hashes we are holding. */
  onStale: () => void;
}) {
  const [step, setStep] = useState<Step>("notice");
  const [seen, setSeen] = useState<ReadonlySet<Step>>(new Set<Step>());
  const [country, setCountry] = useState<string | null>(null);
  const [ageAttested, setAge] = useState(false);
  const [sensitiveAttested, setSensitive] = useState(false);
  const [practiceOptIn, setPractice] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const locale = useMemo(readLocale, []);
  const countries = useMemo(
    // Names follow the device language; only the ORDER is fixed, with
    // Poland pinned first (founder 2026-09-20).
    () => countryChoices(policy, locale),
    [policy, locale],
  );
  // One key for this ATTEMPT, recomputed only when the policy identity changes.
  //
  // Both halves are load-bearing. The RPC replays the same receipt for a
  // repeated key, so every retry of this attempt must reuse it — and a stale
  // refetch must NOT, because that is agreement to different bytes and
  // replaying the earlier receipt would record consent to words that changed.
  // `p_idempotency_key` is TEXT and unique per (principal, key), so carrying
  // the version makes the key self-describing at no cost.
  const attemptKey = useMemo(
    () => `${policy.policyVersion}:${newAttemptKey()}`,
    [policy],
  );

  // A pending country auto-advance, so that leaving the step by any other
  // route — Back, or a second choice — cancels the one already scheduled.
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelAdvance = useCallback(() => {
    if (advance.current === null) return;
    clearTimeout(advance.current);
    advance.current = null;
  }, []);
  useEffect(() => cancelAdvance, [cancelAdvance]);

  const go = useCallback(
    (to: Step) => {
      cancelAdvance();
      setStep(to);
      setSeen((prev) => (prev.has(to) ? prev : new Set(prev).add(to)));
    },
    [cancelAdvance],
  );

  // Choosing a country records it and carries the user on. Re-tapping a
  // different country before the timer fires replaces both the answer and the
  // pending transition, so the last tap is always the one that counts.
  const chooseCountry = useCallback(
    (code: string) => {
      setCountry(code);
      cancelAdvance();
      advance.current = setTimeout(() => {
        advance.current = null;
        go("confirm");
      }, COUNTRY_ADVANCE_MS);
    },
    [cancelAdvance, go],
  );

  // Article 50(1)/(5) is about EXPOSURE, not agreement, so this is written when
  // the notice is shown and not when the button is pressed: someone who reads
  // it and closes the screen was still informed. Best effort — a failed
  // exposure row must never block the screen it is evidence of.
  const exposureSent = useRef(false);
  useEffect(() => {
    if (step !== "ai" || exposureSent.current) return;
    exposureSent.current = true;
    void recordAiNoticeRendered({
      aiNoticeVersion: policy.aiNotice.version,
      surface: "phase1_acceptance",
      clientRenderId: crypto.randomUUID(),
      clientVersion: CLIENT_VERSION,
    });
  }, [step, policy.aiNotice.version]);

  const submit = useCallback(() => {
    if (!country) return;
    setSaving(true);
    setFailure(null);
    void acceptAuthorization({
      policy,
      countryOfResidence: country,
      locale,
      clientVersion: CLIENT_VERSION,
      optionalPurposes: optionalPurposesFor({ practiceOptIn }),
      idempotencyKey: attemptKey,
    })
      .then((result) => {
        if (result.kind === "accepted") {
          onAccepted();
          return;
        }
        if (result.kind === "stale") {
          onStale();
          return;
        }
        setFailure(result.message);
      })
      .finally(() => setSaving(false));
  }, [policy, country, locale, attemptKey, practiceOptIn, onAccepted, onStale]);

  /* ---------------------------------------------------------- declined -- */

  if (declined) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <VoiceMark small />
        <h1 className="max-w-[22ch] text-[27px] font-semibold leading-tight tracking-tight text-foreground">
          Nothing was recorded
        </h1>
        <p className="mt-3.5 max-w-[44ch] text-[14.5px] leading-relaxed text-muted-foreground">
          You can read the documents again, and you can come back and agree at
          any time. Until then recording stays closed.
        </p>
        <div className="mt-10 flex flex-col items-center">
          <Cta
            onClick={() => {
              setDeclined(false);
              go("confirm");
            }}
          >
            Go back
          </Cta>
          <Secondary
            onClick={() => {
              setDeclined(false);
              go("terms");
            }}
          >
            Read the documents again
          </Secondary>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------- documents -- */

  if (step === "terms" || step === "privacy" || step === "ai") {
    const document =
      step === "terms"
        ? policy.terms
        : step === "privacy"
          ? policy.privacy
          : policy.aiNotice;
    const title =
      step === "terms"
        ? "Terms of Service"
        : step === "privacy"
          ? "Privacy Policy"
          : "How AI is used here";
    return (
      <DocumentPane
        title={title}
        document={document}
        onDone={() => go(nextStep(step))}
        onBack={() => go(previousStep(step))}
      />
    );
  }

  /* ----------------------------------------------------------- country -- */

  if (step === "country") {
    /* THIS STEP IS THE ONLY LONG ONE, AND IT COULD NOT SCROLL AT ALL (founder
       2026-09-20, on the first acceptance screen ever shown: "I can't scroll
       the list"). `justify-center` had been copied from the steps that fit a
       phone; with twenty-seven countries a centred flex child that overflows
       spills off BOTH ends, and the overflowing top stays unreachable even
       once scrolling works.

       `m-auto` on the inner column is what fixes that half, and it still does:
       the margins centre the column while it fits and collapse to nothing once
       it is taller than the viewport, leaving an ordinary scroll from the true
       top.

       The scroll CONTAINER has since moved out (founder 2026-09-23). This step
       used to carry its own `overflow-y-auto`, which put a scrollbar inside the
       content; Phase1AcceptanceGate now makes the viewport the scroller for the
       whole flow, so this step only has to lay itself out. */
    return (
      <div className="flex flex-1 flex-col px-6 py-8">
        <div className="m-auto flex w-full max-w-[400px] flex-col items-center text-center">
          <VoiceMark small />
          <h1 className="max-w-[22ch] text-[27px] font-semibold leading-tight tracking-tight text-foreground">
            Where do you live?
          </h1>
          <p className="mt-3.5 max-w-[44ch] text-[14.5px] leading-relaxed text-muted-foreground">
            This decides which law applies to your recording, so it has to be
            your real country of residence.
          </p>
          <div className="mt-6 flex w-full flex-col gap-2">
            {countries.map((choice) => (
              <Choice
                key={choice.code}
                indicator="radio"
                selected={country === choice.code}
                onClick={() => chooseCountry(choice.code)}
              >
                <span className="block text-[15px] font-medium text-foreground">
                  {choice.label}
                </span>
              </Choice>
            ))}
          </div>
          {/* Continue stays, even though a tap now advances on its own. Coming
              BACK from `confirm` lands here with a country already chosen and
              nothing left to tap — without this button that is a dead end. It
              is the fallback, not the main path. */}
          <div className="mt-10 flex flex-col items-center">
            <Cta onClick={() => go("confirm")} disabled={country === null}>
              Continue
            </Cta>
            <Secondary onClick={() => go(previousStep("country"))}>
              Back
            </Secondary>
          </div>
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------- confirm -- */

  if (step === "confirm") {
    const ready = canSubmit(
      { country, ageAttested, sensitiveAttested, practiceOptIn },
      policy,
    );
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
        <VoiceMark small />
        <h1 className="max-w-[22ch] text-[27px] font-semibold leading-tight tracking-tight text-foreground">
          Two things to confirm
        </h1>
        <div className="mt-6 flex w-full max-w-[400px] flex-col gap-2">
          {/* The minimum comes from the policy, never a constant here: a screen
              that hardcodes 18 keeps saying 18 after the policy changes. */}
          <Choice
            indicator="check"
            selected={ageAttested}
            onClick={() => setAge((v) => !v)}
          >
            <span className="block text-[14.5px] leading-snug text-foreground">
              I am {policy.minimumAge} or older.
            </span>
          </Choice>
          {/* Separate from the age tick on purpose. This is the Art 9(2)(a)
              explicit consent, and Art 7(4) is why it cannot be bundled. */}
          <Choice
            indicator="check"
            selected={sensitiveAttested}
            onClick={() => setSensitive((v) => !v)}
          >
            <span className="block text-[14.5px] leading-snug text-foreground">
              I agree that a recording of me speaking may reveal sensitive
              information about me, and I consent to WillpowerLab processing my
              recordings where it does. I can withdraw this at any time, which
              ends my use of recording.
            </span>
          </Choice>
        </div>

        {/* SEPARATE BLOCK, AND NOT PART OF THE HEADING ABOVE. The two ticks
            above are what must be confirmed; this one may be left alone and
            the service still works. It is under its own label so the heading
            stays true of the two, and it is absent from `canSubmit` so
            declining it never blocks the button — an optional purpose that
            gates the button is a required purpose wearing an optional tick.
            TODO(founder sign-off): the label and the sentence below are
            user-facing copy and need approval before this ships. */}
        <div className="mt-5 flex w-full max-w-[400px] flex-col gap-2">
          <p className="text-left text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Optional
          </p>
          <Choice
            indicator="check"
            selected={practiceOptIn}
            onClick={() => setPractice((v) => !v)}
          >
            <span className="block text-[14.5px] leading-snug text-foreground">
              Personalised practice. Use my recordings to choose short
              exercises that fit them, to keep the fragments I re-record, and
              to remember what I am working on so the exercises get more
              personal. I can turn this off at any time and keep using
              everything else.
            </span>
          </Choice>
        </div>

        {failure ? (
          <p
            role="alert"
            className="mt-5 max-w-[40ch] text-[13px] leading-relaxed text-destructive"
          >
            {failure}
          </p>
        ) : null}

        <div className="mt-10 flex flex-col items-center">
          <Cta onClick={submit} disabled={!ready || saving}>
            {saving ? "Saving…" : "Agree and continue"}
          </Cta>
          <Secondary onClick={() => setDeclined(true)}>Do not agree</Secondary>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------ notice -- */

  const documents: { step: Step; label: string; version: string }[] = [
    { step: "terms", label: "Terms of Service", version: policy.terms.version },
    { step: "privacy", label: "Privacy Policy", version: policy.privacy.version },
    { step: "ai", label: "How AI is used here", version: policy.aiNotice.version },
  ];

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
      <VoiceMark small />
      {/* THE HASHED BYTES, VERBATIM. Not a summary of them. */}
      <div className="max-w-[46ch] whitespace-pre-wrap text-left text-[14.5px] leading-relaxed text-muted-foreground">
        {policy.agreementCopy}
      </div>
      <div className="mt-7 flex w-full max-w-[400px] flex-col gap-2">
        {documents.map((document) => (
          <button
            key={document.step}
            type="button"
            onClick={() => go(document.step)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-4 text-left text-[14.5px] text-foreground transition-colors hover:bg-muted"
          >
            <span>
              {document.label}{" "}
              <span className="text-[12.5px] text-muted-foreground">
                v{document.version}
              </span>
            </span>
            {seen.has(document.step) ? (
              <span className="text-[12px] text-success">read ✓</span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="mt-10 flex flex-col items-center">
        {/* Opening all three ticks the rows; it never gates this button. The
            documents must be AVAILABLE before the decision, not proven read. */}
        <Cta onClick={() => go(allDocumentsSeen(seen) ? "country" : "terms")}>
          Continue
        </Cta>
      </div>
    </div>
  );
}

// STEP_ORDER is the contract this file renders against; re-exported so the
// gate and any future progress affordance read the same order.
export { STEP_ORDER };
