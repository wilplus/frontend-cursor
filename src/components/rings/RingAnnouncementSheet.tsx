"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRingState } from "@/hooks/useRingState";
import {
  recordAnnouncementDecision,
  refreshRingState,
  type PendingAnnouncement,
} from "@/services/api/rings";

/* -------------------------------------------------------------------------- */
/*  The announcement sheet (rings, founder 2026-09-29).                         */
/*                                                                            */
/*  When a person's ring reaches a feature that announces itself, the backend  */
/*  lists it in `pending_announcements` and this sheet shows it on their next  */
/*  login. Two answers: "not now" keeps them exactly where they were and       */
/*  stops the sheet until the founder re-announces; "yes" records that they    */
/*  want it. FOR A FEATURE WITH A CONSENT PURPOSE, "yes" CREATES NO CONSENT:   */
/*  it sends the person to the consent screen (the Phase-1 tick), and the      */
/*  feature turns on only when the backend sees that consent (L3). The         */
/*  Phase-2 "yes" stays disabled until the backend reports the legal policy    */
/*  exists.                                                                    */
/*                                                                            */
/*  EVERY VISIBLE STRING HERE IS A PLACEHOLDER. The title and body come from    */
/*  the founder's panel (seeded as "[founder copy] …"); the button labels are   */
/*  placeholders too. Nothing ships as user-facing copy without sign-off.      */
/*  Nothing here shows a score, a ring number or anyone else's data.           */
/* -------------------------------------------------------------------------- */

const COPY = {
  notNow: "[founder copy] Not now",
  yes: "[founder copy] Yes",
  yesToDataChoices: "[founder copy] Turn on in my data choices",
  policyMissing:
    "[founder copy] This choice will be available once the policy is in place.",
  dismiss: "[founder copy] Close",
} as const;

const DATA_CHOICES_PATH = "/account/data-consent";
/** Q7 (founder 2026-09-29): the Phase-2 purpose has its own consent page. */
const MODEL_IMPROVEMENT_PATH = "/account/model-improvement";

function yesLabel(item: PendingAnnouncement): string {
  return item.consent_purpose === "personalised_practice" ? COPY.yesToDataChoices : COPY.yes;
}

/** Where a consent-bearing "yes" sends the person, or null when the purpose
 *  has no screen. The link records the answer; only the screen records a
 *  consent (L3). */
function consentPath(item: PendingAnnouncement): string | null {
  if (item.consent_purpose === "personalised_practice") return DATA_CHOICES_PATH;
  if (item.consent_purpose === "pooled_model_improvement") return MODEL_IMPROVEMENT_PATH;
  return null;
}

function yesIsAvailable(item: PendingAnnouncement): boolean {
  if (!item.requires_consent || !item.consent_purpose) return true;
  return item.consent_policy_available === true;
}

export default function RingAnnouncementSheet() {
  const state = useRingState();
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const pending = (state?.pendingAnnouncements ?? []).filter((a) => !answered.has(a.feature));
  const item = pending[0];

  const answer = useCallback(
    async (target: PendingAnnouncement, decision: "accepted" | "not_now") => {
      if (busy) return;
      setBusy(target.feature);
      await recordAnnouncementDecision(target.feature, decision);
      setAnswered((prev) => new Set(prev).add(target.feature));
      setBusy(null);
      void refreshRingState();
    },
    [busy]
  );

  if (!item) return null;

  const available = yesIsAvailable(item);
  const path = consentPath(item);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ring-announcement-title"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-2xl border border-black/10 bg-white p-5 shadow-2xl"
      data-testid="ring-announcement-sheet"
    >
      <h2 id="ring-announcement-title" className="text-lg font-semibold tracking-tight">
        {item.title}
      </h2>
      <p className="mt-2 whitespace-pre-line text-sm text-foreground/70">{item.body}</p>
      {!available ? (
        <p className="mt-2 text-xs text-foreground/60">{COPY.policyMissing}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-black/10 px-3 py-2 text-sm"
          disabled={busy !== null}
          onClick={() => void answer(item, "not_now")}
        >
          {COPY.notNow}
        </button>
        {path && available ? (
          <Link
            href={path}
            className="rounded-md bg-primary px-3 py-2 text-sm text-white"
            onClick={() => void answer(item, "accepted")}
          >
            {yesLabel(item)}
          </Link>
        ) : (
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-2 text-sm text-white disabled:opacity-50"
            disabled={busy !== null || !available}
            onClick={() => void answer(item, "accepted")}
          >
            {yesLabel(item)}
          </button>
        )}
      </div>
    </div>
  );
}
