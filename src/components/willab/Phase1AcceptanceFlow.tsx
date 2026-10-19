"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  acceptAuthorization,
  recordAiNoticeRendered,
  type PolicyDocument,
  type ProcessingPolicy,
} from "@/services/api/processingAuthorization";
import {
  DOCUMENT_ORDER,
  canSubmit,
  countryChoices,
  prefilledCountry,
  type DocumentKey,
} from "@/lib/legal/acceptanceSteps";

/* -------------------------------------------------------------------------- */
/*  The acceptance screen (founder 2026-10-18: one screen).                    */
/*                                                                            */
/*  Approved on the clickable prototype "Condensed Consent Screens",           */
/*  https://claude.ai/artifact/6v4vEhppupQc9LC2tzbD6H (version 6): the voice   */
/*  mark, the agreement text, the three documents as links that open in a      */
/*  window, the country as a dropdown, the one tick (the recordings consent),  */
/*  then "Agree and continue" and "Do not agree". It replaces the six-screen   */
/*  walk of 2026-10-07 (notice, three document screens, country, confirm).     */
/*                                                                            */
/*  EVERY WORD THAT STATES A FACT COMES FROM THE POLICY RECORD. The component  */
/*  holds no legal copy, no country list, no age. It renders `agreement_copy`  */
/*  and the three documents as the exact stored bytes — whitespace preserved,  */
/*  never markdown, never re-wrapped — because those bytes are what the hashes */
/*  cover and what a user later proves they agreed to. The agreement text is   */
/*  what the button accepts: the Terms and the age are confirmed by tapping    */
/*  it, as the text says. The recordings consent (Art 9(2)(a)) stays its own   */
/*  tick, separate from the contract, which Art 7 is the reason for.           */
/*                                                                            */
/*  The strings this file DOES own are navigation and scaffolding — the        */
/*  document names, "Choose your country *", "Continue", "Agree and continue", */
/*  "Do not agree". Anything that states a fact about processing belongs in    */
/*  the policy copy, under founder sign-off (LIVE LOOP fence).                 */
/* -------------------------------------------------------------------------- */

const CLIENT_VERSION = "phase1-acceptance-web-v2";

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

const DOCUMENT_TITLES: Record<DocumentKey, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  ai: "How AI is used here",
};

/* ---------------------------------------------------------------- pieces -- */

/** The breathing voice mark from WelcomeConsent, at the screen's scale: 64px
 *  on a phone, 80px on a computer (the prototype's sizes). Decorative: the
 *  rings and dots carry no state and are aria-hidden. */
function VoiceMark() {
  return (
    <div
      className="relative mb-4 flex h-16 w-16 items-center justify-center md:mb-5 md:h-20 md:w-20"
      aria-hidden="true"
    >
      <span className="breath-ring absolute inset-0 rounded-full border border-foreground/10" />
      <span
        className="breath-ring absolute inset-1.5 rounded-full border border-foreground/15"
        style={{ animationDelay: "0.6s" }}
      />
      <span
        className="breath-ring absolute inset-3 rounded-full border border-primary/30"
        style={{ animationDelay: "1.2s" }}
      />
      <svg className="h-7 w-7 md:h-8 md:w-8" viewBox="0 0 56 56" aria-hidden="true">
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

/** The tick. One shape, because the country used to be the same kind of
 *  question; it is a dropdown now and this is the one tick left. */
function Tick({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
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
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors ${
          selected
            ? "border-foreground bg-foreground"
            : "border-muted-foreground/60 bg-background"
        }`}
      >
        {selected ? (
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

/** A stored document in its own window: the title, its version and the
 *  button stay still and only the text scrolls (consent lock 2026-10-15).
 *  On a phone the window is the whole screen; on a computer it sits in the
 *  middle, as the Read more window does. The bytes are the hashed ones:
 *  no markdown, no per-line styling. */
function DocumentWindow({
  title,
  document,
  onDone,
}: {
  title: string;
  document: PolicyDocument;
  onDone: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background pt-[env(safe-area-inset-top)] md:bg-foreground/35 md:p-4 md:pt-4"
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-background px-6 pb-6 pt-8 text-left md:max-h-[40rem] md:max-w-[40rem] md:rounded-2xl md:shadow-xl">
        <div className="shrink-0 border-b border-border pb-4">
          <h2 className="text-[24px] font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Version {document.version}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap py-5 text-[15px] leading-[1.7] text-foreground/90">
          {document.copy}
        </div>
        <div className="flex shrink-0 justify-center pt-4">
          <Cta onClick={onDone}>Continue</Cta>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ flow -- */

export default function Phase1AcceptanceFlow({
  policy,
  priorCountry = null,
  onAccepted,
  onStale,
}: {
  policy: ProcessingPolicy;
  /** The country this person gave last time (a re-acceptance), shown already
   *  chosen; null asks it fresh (N48.4 Q21 A). */
  priorCountry?: string | null;
  /** A receipt now exists for this principal. The gate re-renders its child. */
  onAccepted: () => void;
  /** The policy moved under us. The gate must refetch and re-present; we must
   *  not resubmit the hashes we are holding. */
  onStale: () => void;
}) {
  // Asked once, prefilled after (Q21 A): the person's own earlier answer,
  // never a guess. It still shows and can still be changed.
  const [country, setCountry] = useState<string | null>(() =>
    prefilledCountry(policy, priorCountry),
  );
  const [sensitiveAttested, setSensitive] = useState(false);
  const [seen, setSeen] = useState<ReadonlySet<DocumentKey>>(new Set<DocumentKey>());
  const [open, setOpen] = useState<DocumentKey | null>(null);
  const [declined, setDeclined] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const locale = useMemo(readLocale, []);
  const countries = useMemo(
    // Names follow the device language; only the ORDER is fixed, with
    // Poland pinned first (founder 2026-09-20) and the United States
    // (California) second (founder 2026-10-15).
    () => countryChoices(policy, locale),
    [policy, locale],
  );
  // One key for this ATTEMPT, recomputed only when the policy identity changes.
  //
  // Both halves are load-bearing. The RPC replays the same receipt for a
  // repeated key, so every retry of this attempt must reuse it — and a stale
  // refetch must NOT, because that is agreement to different bytes and
  // replaying the earlier receipt would record consent to words that changed.
  const attemptKey = useMemo(
    () => `${policy.policyVersion}:${newAttemptKey()}`,
    [policy],
  );

  const openDocument = useCallback((key: DocumentKey) => {
    setOpen(key);
    setSeen((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);

  // Article 50(1)/(5) is about EXPOSURE, not agreement, so this is written
  // when the notice is opened and not when the button is pressed: someone
  // who reads it and closes the screen was still informed. Best effort — a
  // failed exposure row must never block the screen it is evidence of.
  const exposureSent = useRef(false);
  useEffect(() => {
    if (open !== "ai" || exposureSent.current) return;
    exposureSent.current = true;
    void recordAiNoticeRendered({
      aiNoticeVersion: policy.aiNotice.version,
      surface: "phase1_acceptance",
      clientRenderId: crypto.randomUUID(),
      clientVersion: CLIENT_VERSION,
    });
  }, [open, policy.aiNotice.version]);

  const ready = canSubmit({ country, sensitiveAttested }, policy);

  const submit = useCallback(() => {
    if (!country) return;
    setSaving(true);
    setFailure(null);
    void acceptAuthorization({
      policy,
      countryOfResidence: country,
      locale,
      clientVersion: CLIENT_VERSION,
      // Nothing optional is offered on this screen: practice is part of the
      // service (Privacy 3.4+), and the training choice left the screen with
      // the founder's decision of 2026-10-18. An empty array is a recorded
      // "nothing chosen", not a missing answer.
      optionalPurposes: [],
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
  }, [policy, country, locale, attemptKey, onAccepted, onStale]);

  /* THE SCREEN OPENS AT ITS TOP AND FADES IN (consent lock 2026-10-07). The
     gate's viewport scroller outlives the screens, so "Nothing was recorded"
     and the way back each reset it. The fade is CSS (`.acceptance-step`),
     instant with reduce motion. A re-render inside a screen (a tick) keeps
     the scroll. */
  const screenKey = declined ? "declined" : "agree";
  const stepRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    for (let el = stepRef.current?.parentElement; el; el = el.parentElement) {
      if (el.scrollTop > 0) el.scrollTop = 0;
    }
  }, [screenKey]);

  const window_ = open ? (
    <DocumentWindow
      title={DOCUMENT_TITLES[open]}
      document={
        open === "terms" ? policy.terms : open === "privacy" ? policy.privacy : policy.aiNotice
      }
      onDone={() => setOpen(null)}
    />
  ) : null;

  /* ---------------------------------------------------------- declined -- */

  if (declined) {
    return (
      <div key={screenKey} ref={stepRef} className="acceptance-step flex flex-1 flex-col">
        <div className="flex flex-1 flex-col px-6 py-8">
          <div className="m-auto flex w-full max-w-[400px] flex-col items-center text-center">
            <VoiceMark />
            <h1 className="max-w-[22ch] text-[27px] font-semibold leading-tight tracking-tight text-foreground">
              Nothing was recorded
            </h1>
            <p className="mt-3.5 max-w-[44ch] text-[14.5px] leading-relaxed text-muted-foreground">
              You can read the documents again, and you can come back and agree at
              any time. Until then recording stays closed.
            </p>
            <div className="mt-10 flex flex-col items-center">
              <Cta onClick={() => setDeclined(false)}>Go back</Cta>
              <Secondary
                onClick={() => {
                  setDeclined(false);
                  openDocument("terms");
                }}
              >
                Read the documents again
              </Secondary>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- agree -- */

  return (
    <div key={screenKey} ref={stepRef} className="acceptance-step flex flex-1 flex-col">
      {/* Laid out with m-auto, never justify-center, so a phone shorter than
          the screen scrolls it from its true top. The rhythm is the
          prototype's phone rhythm (24px top, 16px bottom, 24px before the
          buttons); the 390×844 phone and a computer show it whole. */}
      <div className="flex flex-1 flex-col px-6 pb-4 pt-6 md:py-8">
        <div className="m-auto flex w-full max-w-[400px] flex-col items-center text-center">
          <VoiceMark />
          {/* THE HASHED BYTES, VERBATIM. Not a summary of them. */}
          <div className="max-w-[46ch] whitespace-pre-wrap text-center text-[14.5px] leading-[1.6] text-muted-foreground md:leading-relaxed">
            {policy.agreementCopy}
          </div>
          {/* The documents must be AVAILABLE before the decision, not proven
              read: opening one ticks its name and never gates the button. */}
          <div className="mt-3 flex w-full flex-wrap items-baseline justify-center gap-x-3.5 gap-y-1.5 text-[13px] md:mt-4">
            {DOCUMENT_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => openDocument(key)}
                className="inline-flex items-baseline gap-1.5 py-0.5 text-foreground"
              >
                <span className="underline underline-offset-[3px]">{DOCUMENT_TITLES[key]}</span>
                {seen.has(key) ? (
                  <span className="text-[12px] text-success">read ✓</span>
                ) : null}
              </button>
            ))}
          </div>
          {/* The country decides which law applies to the recording, so the
              receipt records it; nothing is preselected except the person's
              own earlier answer. The asterisk marks it required, like the
              tick below. */}
          <div className="relative mt-3.5 w-full md:mt-5">
            <select
              id="acceptance-country"
              aria-label="Country of residence"
              value={country ?? ""}
              onChange={(event) => setCountry(event.target.value || null)}
              className={`h-14 w-full cursor-pointer appearance-none rounded-xl border bg-background pl-4 pr-11 text-[15px] text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                country ? "border-foreground font-medium" : "border-border font-normal text-muted-foreground"
              }`}
            >
              <option value="" disabled>
                Choose your country *
              </option>
              {countries.map((choice) => (
                <option key={choice.code} value={choice.code}>
                  {choice.label}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          {/* The Art 9(2)(a) explicit consent, on its own and never bundled
              with the contract the button accepts (Art 7(4)). The founder's
              wording (consent prototype, 2026-10-15). */}
          <div className="mt-2.5 w-full md:mt-3">
            <Tick selected={sensitiveAttested} onClick={() => setSensitive((v) => !v)}>
              <span className="block text-[14.5px] leading-snug text-foreground">
                I agree that WillpowerLab may process my recordings. *
              </span>
            </Tick>
          </div>

          {failure ? (
            <p
              role="alert"
              className="mt-5 max-w-[40ch] text-[13px] leading-relaxed text-destructive"
            >
              {failure}
            </p>
          ) : null}

          {/* Consent stays a deliberate second action: nothing on this screen
              advances on its own, and a receipt that names bytes the user
              never meant to accept is worse than an extra tap. */}
          <div className="mt-6 flex flex-col items-center md:mt-10">
            <Cta onClick={submit} disabled={!ready || saving}>
              {saving ? "Saving…" : "Agree and continue"}
            </Cta>
            <Secondary onClick={() => setDeclined(true)}>Do not agree</Secondary>
          </div>
        </div>
      </div>
      {window_}
    </div>
  );
}
