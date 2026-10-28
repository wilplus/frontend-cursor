"use client";

import { useEffect, useState } from "react";
import { fetchPublishedPolicyText } from "@/services/api/publishedPolicy";
import { planSection } from "@/lib/legal/policySection";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";
import { PLAN_COPY } from "@/lib/willab/planCopy";

/* -------------------------------------------------------------------------- */
/*  Read more, after Will's ask for the plan's own yes (founder 2026-10-27,   */
/*  "approved as drawn", backend N211). An underlined link in the ask's own   */
/*  colour that opens Privacy section 4e in a window, as Read more does for   */
/*  the training sentence (TrainingReadMore): the title and Continue stay     */
/*  still, only the text scrolls. The published policy is read when the       */
/*  window opens.                                                             */
/* -------------------------------------------------------------------------- */

export default function PlanReadMore() {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState<{ copy: string; version: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || doc) return;
    let alive = true;
    void fetchPublishedPolicyText("privacy").then((state) => {
      if (!alive) return;
      if (state.kind === "published") setDoc({ copy: state.copy, version: state.version });
      else setFailed(true);
    });
    return () => { alive = false; };
  }, [open, doc]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline text-inherit underline underline-offset-4"
      >
        {PLAN_COPY.readMore}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={doc ? PLAN_COPY.consentWindow(doc.version) : PLAN_COPY.privacyPolicy}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/35 p-4"
        >
          <div className="flex h-full max-h-[40rem] w-full max-w-[40rem] flex-col overflow-hidden rounded-2xl bg-background px-6 pb-6 pt-8 text-left shadow-xl">
            <div className="shrink-0 border-b border-border pb-4">
              <h2 className="text-[24px] font-semibold tracking-tight text-foreground">
                {doc ? PLAN_COPY.consentWindow(doc.version) : PLAN_COPY.privacyPolicy}
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap py-5 text-[15px] leading-[1.7] text-foreground/90">
              {doc ? planSection(doc.copy) : failed ? COPY.privacyUnavailable : null}
            </div>
            <div className="flex shrink-0 justify-center pt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-7 text-[14px] font-medium text-background transition hover:bg-foreground/90"
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
