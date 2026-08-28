"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LoadingState from "./LoadingState";
import { createClient } from "@/lib/supabase/client";
import {
  fetchMlc2Consent,
  grantMlc2Consent,
  type Mlc2ConsentStatus,
} from "@/services/api/mlc2Consent";


type State =
  | { kind: "checking" }
  | { kind: "pass" }
  | { kind: "required"; status: Mlc2ConsentStatus }
  | { kind: "error"; message: string };

export default function Mlc2FounderConsentGate({
  founderEligible,
  children,
}: {
  founderEligible: boolean | null;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<State>({ kind: "checking" });
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    if (founderEligible === null) {
      setState({ kind: "checking" });
      return;
    }
    if (!founderEligible) {
      setState({ kind: "pass" });
      return;
    }
    let active = true;
    setState({ kind: "checking" });
    void fetchMlc2Consent()
      .then((status) => {
        if (!active) return;
        if (!status.applicable || status.granted) {
          setState({ kind: "pass" });
          return;
        }
        if (!status.configured || !status.onboarding_copy) {
          throw new Error("Model-improvement consent is not configured yet.");
        }
        setState({ kind: "required", status });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "Consent service is unavailable.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [founderEligible]);

  const copy = state.kind === "required" ? state.status.onboarding_copy ?? "" : "";
  const [bodyCopy, affirmation] = useMemo(() => {
    const boundary = copy.lastIndexOf("\n\n");
    if (boundary < 0) return [copy, copy];
    return [copy.slice(0, boundary), copy.slice(boundary + 2)];
  }, [copy]);

  if (state.kind === "pass") return <>{children}</>;
  if (state.kind === "checking") return <LoadingState placement="surface" />;

  if (state.kind === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <p className="max-w-md text-[17px] font-medium text-foreground">
          We couldn&apos;t prepare the consent screen safely.
        </p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          {state.message} Recording remains unavailable until this is resolved.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-7 h-12 rounded-full border border-border px-7 text-sm font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  const leave = async () => {
    await createClient().auth.signOut();
    window.location.assign("/");
  };

  return (
    <div className="flex flex-1 overflow-y-auto px-2 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto my-auto w-full max-w-[38rem] py-5 text-left">
        <div className="whitespace-pre-line text-[15px] leading-[1.65] text-foreground">
          {bodyCopy}
        </div>

        {!declined ? (
          <>
            <label className="mt-7 flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span className="text-[14px] leading-relaxed text-foreground">
                {affirmation}
              </span>
            </label>
            <button
              type="button"
              disabled={!accepted || saving}
              onClick={() => {
                setSaving(true);
                void grantMlc2Consent(state.status)
                  .then((next) => {
                    if (!next.granted) throw new Error("Consent was not confirmed.");
                    setState({ kind: "pass" });
                  })
                  .catch((error: unknown) => {
                    setState({
                      kind: "error",
                      message:
                        error instanceof Error
                          ? error.message
                          : "Consent could not be recorded.",
                    });
                  })
                  .finally(() => setSaving(false));
              }}
              className="mt-6 h-12 w-full rounded-full bg-foreground px-6 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-35"
            >
              {saving ? "Saving…" : "Agree and continue"}
            </button>
            <button
              type="button"
              onClick={() => setDeclined(true)}
              className="mt-3 h-11 w-full text-sm text-muted-foreground underline underline-offset-4"
            >
              Do not agree
            </button>
          </>
        ) : (
          <div className="mt-7 rounded-2xl border border-border p-5 text-center">
            <p className="text-sm leading-relaxed text-foreground">
              Recording and coaching require this consent. No consent has been
              stored.
            </p>
            <button
              type="button"
              onClick={() => setDeclined(false)}
              className="mt-5 h-11 rounded-full bg-foreground px-6 text-sm font-medium text-background"
            >
              Review again
            </button>
            <button
              type="button"
              onClick={() => void leave()}
              className="mt-3 block w-full text-sm text-muted-foreground underline underline-offset-4"
            >
              Leave WillpowerLab
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/terms" className="underline underline-offset-4">
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  );
}
