"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONSENT, GUIDE, STATUS } from "@/lib/life/copy";
import { postConsent } from "@/services/api/life";
import { invalidateLifeState } from "@/lib/life/useLifeState";

/* -------------------------------------------------------------------------- */
/*  FE-2 — first run: the guide, then consent                                  */
/*                                                                            */
/*  N2 — NO LIFE DATA IS WRITTEN BEFORE THIS PASSES. The only request either   */
/*  page makes is the consent POST itself.                                     */
/*                                                                            */
/*  The consent screen cannot be skipped and cannot be defaulted to accepted   */
/*  (L-6): the checkbox starts unchecked, and the accept button does not       */
/*  submit until it is ticked. "Not now" leaves without writing anything, and  */
/*  is not styled as the lesser option, because declining is a real answer.    */
/*                                                                            */
/*  Page 1 lists no features and asks for nothing. It explains what a          */
/*  principle is, what # does, and why anyone would bother.                    */
/* -------------------------------------------------------------------------- */

export default function FirstRun({
  requiredVersion,
  onConsented,
}: {
  requiredVersion: string;
  onConsented: () => void;
}) {
  const [page, setPage] = useState<1 | 2>(1);
  return page === 1 ? (
    <GuidePage onContinue={() => setPage(2)} />
  ) : (
    <ConsentPage
      requiredVersion={requiredVersion}
      onBack={() => setPage(1)}
      onConsented={onConsented}
    />
  );
}

function GuidePage({ onContinue }: { onContinue: () => void }) {
  return (
    <article className="mx-auto max-w-xl">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {GUIDE.title}
      </h1>
      <div className="mt-6 space-y-5">
        {GUIDE.paragraphs.map((p, i) => (
          <p key={i} className="text-[16px] leading-[1.7] text-foreground/90">
            {p}
          </p>
        ))}
      </div>
      {/* Centred, like every CTA in the onboarding. */}
      <button
        type="button"
        onClick={onContinue}
        className="mx-auto mt-8 block rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:bg-foreground/90"
      >
        {GUIDE.continueLabel}
      </button>
    </article>
  );
}

function ConsentPage({
  requiredVersion,
  onBack,
  onConsented,
}: {
  requiredVersion: string;
  onBack: () => void;
  onConsented: () => void;
}) {
  const router = useRouter();
  // Starts false, always. There is no path that pre-ticks this.
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function accept() {
    if (!agreed || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await postConsent(requiredVersion);
      invalidateLifeState();
      onConsented();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <article className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {CONSENT.title}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        {CONSENT.intro}
      </p>

      <dl className="mt-7 space-y-5">
        {CONSENT.points.map((point) => (
          <div key={point.heading}>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {point.heading}
            </dt>
            <dd className="mt-1 text-[15px] leading-[1.7] text-foreground/90">
              {point.body}
            </dd>
          </div>
        ))}
      </dl>

      <label className="mt-8 flex items-start gap-3 rounded-2xl border border-border p-4">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-foreground"
        />
        <span className="text-sm leading-relaxed text-foreground">
          {CONSENT.checkboxLabel}
        </span>
      </label>

      {failed ? (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {STATUS.error}
        </p>
      ) : null}

      {/* Founder 2026-07-27 — CTAs are centred across the onboarding, never
          left-aligned. */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={accept}
          disabled={!agreed || saving}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-40"
        >
          {saving ? STATUS.saving : CONSENT.acceptLabel}
        </button>
        <button
          type="button"
          onClick={() => router.push("/chat")}
          className="rounded-full border border-border px-4 py-2.5 text-sm text-foreground hover:bg-muted"
        >
          {CONSENT.declineLabel}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Read that again
        </button>
      </div>
    </article>
  );
}
