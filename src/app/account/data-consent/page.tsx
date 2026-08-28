"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import LoadingState from "@/components/willab/LoadingState";
import { createClient } from "@/lib/supabase/client";
import {
  fetchMlc2Consent,
  withdrawMlc2Consent,
  type Mlc2ConsentStatus,
} from "@/services/api/mlc2Consent";


export default function DataConsentPage() {
  const [status, setStatus] = useState<Mlc2ConsentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchMlc2Consent()
      .then(setStatus)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Unable to load consent."),
      );
  }, []);

  const withdraw = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await withdrawMlc2Consent();
      setStatus(next);
      await createClient().auth.signOut();
      window.location.assign("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Withdrawal failed.");
      setSaving(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <DashboardHeader />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Data &amp; consent</h1>
        {!status && !error ? <LoadingState placement="surface" /> : null}
        {error ? (
          <p className="mt-6 rounded-2xl border border-border p-5 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {status?.applicable === false ? (
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            No MLC-2 founder-canary consent applies to this account.
          </p>
        ) : null}
        {status?.applicable && !status.granted ? (
          <div className="mt-6 rounded-2xl border border-border p-5">
            <p className="text-sm leading-relaxed">
              Model-improvement consent is not active. Recording and coaching
              remain unavailable.
            </p>
            <Link
              href="/chat"
              className="mt-5 inline-flex h-11 items-center rounded-full bg-foreground px-6 text-sm font-medium text-background"
            >
              Review consent
            </Link>
          </div>
        ) : null}
        {status?.applicable && status.granted ? (
          <div className="mt-6 rounded-2xl border border-border p-5">
            <p className="text-sm font-medium">Consent is active</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              It covers personalized coaching and improvement of WillpowerLab’s
              shared models under policy {status.consent_policy_version}.
            </p>
            {!confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="mt-6 text-sm text-destructive underline underline-offset-4"
              >
                Withdraw consent
              </button>
            ) : (
              <div className="mt-6 rounded-xl bg-muted p-4">
                <p className="text-sm leading-relaxed">
                  Withdrawing ends access to recording and coaching. It also
                  starts the canonical retention and purge process.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void withdraw()}
                    className="h-10 rounded-full bg-destructive px-5 text-sm font-medium text-destructive-foreground disabled:opacity-50"
                  >
                    {saving ? "Withdrawing…" : "Confirm withdrawal"}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setConfirming(false)}
                    className="h-10 rounded-full border border-border px-5 text-sm"
                  >
                    Keep consent
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
        <p className="mt-8 text-sm text-muted-foreground">
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/terms" className="underline underline-offset-4">
            Terms of Service
          </Link>
        </p>
      </div>
    </main>
  );
}
