"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SymmetricPair from "./SymmetricPair";
import TrainingReadMore from "@/components/legal/TrainingReadMore";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";
import { fetchConsentChoices, setConsentChoice } from "@/services/api/consentChoices";
import { fetchPublishedPolicyText } from "@/services/api/publishedPolicy";
import {
  fetchTrainingConsent,
  reportTrainingRefusal,
  setTrainingConsent,
  trainingRefusalCode,
  type TrainingConsent,
} from "@/services/api/trainingConsent";

/* -------------------------------------------------------------------------- */
/*  A consent ask answered in the chat (founder 2026-10-18: "I should be able */
/*  to click a link to see it but the answers should be to accept or not";   */
/*  approved: No | Yes).                                                       */
/*                                                                            */
/*  Laid out as the policy update ask: the grey card with the question's own  */
/*  words from Data & consent and Read more (the document in a window), then  */
/*  No | Yes in place of the record button. Yes saves through the very call   */
/*  the Data & consent page makes, after the same words; No changes nothing.  */
/*  The training yes keeps its signed words (wording v4: the same three parts */
/*  on every screen that asks).                                                */
/*                                                                            */
/*  Anything this card cannot show (the processing receipt, a switch the      */
/*  policy does not offer, a read that failed) keeps the old pair: Not now |  */
/*  Open, to the Data & consent page.                                          */
/* -------------------------------------------------------------------------- */

type Answerable = "personalised_practice" | "sensitive_information" | "training";

type Loaded =
  | { kind: "loading" }
  | { kind: "page" }
  | { kind: "choice"; key: "personalised_practice" | "sensitive_information" }
  | { kind: "training"; state: TrainingConsent };

function answerable(key: string | null): key is Answerable {
  return key === "personalised_practice" || key === "sensitive_information" || key === "training";
}

async function load(key: Answerable): Promise<Loaded> {
  if (key === "training") {
    const state = await fetchTrainingConsent();
    return state?.available && state.copy ? { kind: "training", state } : { kind: "page" };
  }
  const choices = await fetchConsentChoices();
  if (!choices?.hasReceipt) return { kind: "page" };
  if (key === "personalised_practice" && !choices.practiceOffered) return { kind: "page" };
  return { kind: "choice", key };
}

export function ConsentAskActions({
  consentKey,
  onOpened,
  onAnswered,
  onResolve,
}: {
  consentKey: string | null;
  /** The old pair took them to the Data & consent page. */
  onOpened: () => void;
  /** They answered in the chat, yes or no. */
  onAnswered: () => void;
  onResolve: () => void;
}) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded>(() =>
    answerable(consentKey) ? { kind: "loading" } : { kind: "page" },
  );
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!answerable(consentKey)) return;
    let live = true;
    void load(consentKey).then((next) => {
      if (live) setLoaded(next);
    });
    return () => {
      live = false;
    };
  }, [consentKey]);

  if (loaded.kind === "loading") return null;
  if (loaded.kind === "page") {
    return (
      <SymmetricPair
        closeLabel="Not now"
        onClose={onResolve}
        actionLabel="Open"
        onAction={() => {
          onOpened();
          onResolve();
          router.push("/account/data-consent");
        }}
      />
    );
  }

  const yes = async () => {
    if (saving) return;
    setSaving(true);
    setFailed(false);
    let ok: boolean;
    if (loaded.kind === "training") {
      const next = await setTrainingConsent(true, loaded.state);
      ok = Boolean(next) && !("ok" in next);
      if (!ok) reportTrainingRefusal(trainingRefusalCode(next) ?? "NO_STATE", "ask");
    } else {
      ok = (await setConsentChoice(loaded.key, true)) !== null;
    }
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    onAnswered();
    onResolve();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-muted p-3 text-left text-[14px] leading-relaxed text-foreground">
        {loaded.kind === "training" ? (
          <>
            <p className="font-medium">{COPY.trainingQuestion}</p>
            <p className="mt-1">
              {loaded.state.copy} <TrainingReadMore />
            </p>
          </>
        ) : loaded.key === "personalised_practice" ? (
          <>
            <p className="font-medium">{COPY.practiceTitle}</p>
            <p className="mt-1">
              {COPY.practiceDescription} <PrivacyReadMore />
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">{COPY.sensitiveTitle}</p>
            <p className="mt-1">
              {COPY.sensitiveText} <PrivacyReadMore />
            </p>
            <p className="mt-1">{COPY.recordingOff}</p>
          </>
        )}
      </div>
      <SymmetricPair
        closeLabel="No"
        onClose={() => {
          onAnswered();
          onResolve();
        }}
        actionLabel={loaded.kind === "training" ? COPY.trainingYes : "Yes"}
        onAction={() => void yes()}
      />
      {failed ? (
        <p role="alert" className="text-[13px] text-destructive">
          {COPY.failed}
        </p>
      ) : null}
    </div>
  );
}

/** Read more: the Privacy Policy in a window, the title and the button still
 *  and only the text scrolling, as the policy update ask shows its documents. */
function PrivacyReadMore() {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState<{ copy: string; version: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || doc) return;
    let live = true;
    void fetchPublishedPolicyText("privacy").then((state) => {
      if (!live) return;
      if (state.kind === "published") setDoc({ copy: state.copy, version: state.version });
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [open, doc]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline text-inherit underline underline-offset-4"
      >
        {COPY.readMore}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Privacy Policy"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/35 p-4 pt-[max(1rem,env(safe-area-inset-top))]"
        >
          <div className="flex h-full max-h-[40rem] w-full max-w-[40rem] flex-col overflow-hidden rounded-2xl bg-background px-6 pb-6 pt-8 text-left shadow-xl">
            <div className="shrink-0 border-b border-border pb-4">
              <h2 className="text-[24px] font-semibold tracking-tight text-foreground">Privacy Policy</h2>
              {doc ? (
                <p className="mt-1 text-[12.5px] text-muted-foreground">Version {doc.version}</p>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap py-5 text-[15px] leading-[1.7] text-foreground/90">
              {doc ? doc.copy : failed ? COPY.privacyUnavailable : null}
            </div>
            <div className="flex shrink-0 justify-center pt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-7 text-[14px] font-medium text-background transition hover:bg-foreground/90"
              >
                Continue
                <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
