"use client";

/* -------------------------------------------------------------------------- */
/*  The model-improvement consent, on its own page (Q7, founder 2026-09-29).  */
/*                                                                            */
/*  The founder gate (Mlc2FounderConsentGate) shows this same form to the     */
/*  founder before the Lounge. A tester reaches it from the announcement      */
/*  sheet's Phase-2 "yes" instead. Same backend route, same explicit          */
/*  checkbox, same policy and copy identifiers; the backend decides who the   */
/*  ring row reaches, and answers applicable=false to everyone else.          */
/*                                                                            */
/*  L3: the sheet's "yes" recorded an answer; only the checkbox here records  */
/*  a consent. AC-9: nothing about the person's speech appears on this page.  */
/* -------------------------------------------------------------------------- */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LoadingState from "@/components/willab/LoadingState";
import {
  fetchMlc2Consent,
  grantMlc2Consent,
  withdrawMlc2Consent,
  type Mlc2ConsentStatus,
} from "@/services/api/mlc2Consent";
import {
  DATA_CHOICES_PATH,
  MODEL_IMPROVEMENT_COPY as COPY,
} from "@/lib/legal/modelImprovementCopy";

type State =
  | { kind: "checking" }
  | { kind: "not_applicable" }
  | { kind: "granted" }
  | { kind: "required"; status: Mlc2ConsentStatus }
  | { kind: "error"; message: string };

function fromStatus(status: Mlc2ConsentStatus): State {
  if (!status.applicable) return { kind: "not_applicable" };
  if (status.granted) return { kind: "granted" };
  if (!status.configured || !status.onboarding_copy) {
    return { kind: "error", message: "Model-improvement consent is not configured yet." };
  }
  return { kind: "required", status };
}

export default function ModelImprovementConsent() {
  const [state, setState] = useState<State>({ kind: "checking" });
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchMlc2Consent()
      .then((status) => {
        if (active) setState(fromStatus(status));
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            kind: "error",
            message: error instanceof Error ? error.message : "Consent service is unavailable.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const copy = state.kind === "required" ? state.status.onboarding_copy ?? "" : "";
  const [bodyCopy, affirmation] = useMemo(() => {
    const boundary = copy.lastIndexOf("\n\n");
    if (boundary < 0) return [copy, copy];
    return [copy.slice(0, boundary), copy.slice(boundary + 2)];
  }, [copy]);

  const backLink = (
    <p className="mt-6 text-center text-xs text-muted-foreground">
      <Link href={DATA_CHOICES_PATH} className="underline underline-offset-4">
        {COPY.back}
      </Link>
    </p>
  );

  if (state.kind === "checking") return <LoadingState placement="surface" />;

  if (state.kind === "not_applicable") {
    return (
      <div className="mx-auto w-full max-w-[38rem] py-5 text-left">
        <p className="text-[15px] leading-relaxed text-foreground" data-testid="mi-not-applicable">
          {COPY.notApplicable}
        </p>
        {backLink}
      </div>
    );
  }

  if (state.kind === "granted") {
    return (
      <div className="mx-auto w-full max-w-[38rem] py-5 text-left">
        <p className="text-[15px] leading-relaxed text-foreground" data-testid="mi-granted">
          {COPY.granted}
        </p>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            void withdrawMlc2Consent()
              .then((next) => setState(fromStatus(next)))
              .catch((error: unknown) => {
                setState({
                  kind: "error",
                  message: error instanceof Error ? error.message : "Consent could not be withdrawn.",
                });
              })
              .finally(() => setSaving(false));
          }}
          className="mt-6 h-11 rounded-full border border-border px-6 text-sm font-medium disabled:opacity-35"
        >
          {saving ? COPY.withdrawing : COPY.withdraw}
        </button>
        {backLink}
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <p className="max-w-md text-[17px] font-medium text-foreground">{COPY.errorTitle}</p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{state.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-7 h-12 rounded-full border border-border px-7 text-sm font-medium"
        >
          {COPY.tryAgain}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[38rem] py-5 text-left">
      <div className="whitespace-pre-line text-[15px] leading-[1.65] text-foreground">{bodyCopy}</div>

      {!declined ? (
        <>
          <label className="mt-7 flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1 h-4 w-4 accent-primary"
              data-testid="mi-checkbox"
            />
            <span className="text-[14px] leading-relaxed text-foreground">{affirmation}</span>
          </label>
          <button
            type="button"
            disabled={!accepted || saving}
            onClick={() => {
              setSaving(true);
              void grantMlc2Consent(state.status)
                .then((next) => {
                  if (!next.granted) throw new Error("Consent was not confirmed.");
                  setState({ kind: "granted" });
                })
                .catch((error: unknown) => {
                  setState({
                    kind: "error",
                    message: error instanceof Error ? error.message : "Consent could not be recorded.",
                  });
                })
                .finally(() => setSaving(false));
            }}
            className="mt-6 h-12 w-full rounded-full bg-foreground px-6 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-35"
            data-testid="mi-agree"
          >
            {saving ? COPY.saving : COPY.agree}
          </button>
          <button
            type="button"
            onClick={() => setDeclined(true)}
            className="mt-3 h-11 w-full text-sm text-muted-foreground underline underline-offset-4"
          >
            {COPY.doNotAgree}
          </button>
        </>
      ) : (
        <div className="mt-7 rounded-2xl border border-border p-5 text-center">
          <p className="text-sm leading-relaxed text-foreground">{COPY.declined}</p>
          <button
            type="button"
            onClick={() => setDeclined(false)}
            className="mt-5 h-11 rounded-full bg-foreground px-6 text-sm font-medium text-background"
          >
            {COPY.reviewAgain}
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link href="/privacy" className="underline underline-offset-4">
          {COPY.privacy}
        </Link>
        {" · "}
        <Link href="/terms" className="underline underline-offset-4">
          {COPY.terms}
        </Link>
      </p>
      {backLink}
    </div>
  );
}
