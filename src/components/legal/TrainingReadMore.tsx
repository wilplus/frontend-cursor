"use client";

import { useEffect, useState } from "react";
import { fetchPublishedPolicyText } from "@/services/api/publishedPolicy";
import { trainingSection } from "@/lib/legal/policySection";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";

/* -------------------------------------------------------------------------- */
/*  Read more, after the training sentence (training wording v4, founder      */
/*  2026-10-15). An underlined link in the sentence's own colour that opens   */
/*  Privacy section 4a in a window: the title and the button stay still and   */
/*  only the text scrolls, as on the document screens. The acceptance flow    */
/*  passes the copy it already holds; the other screens read the published   */
/*  policy when the window opens.                                             */
/* -------------------------------------------------------------------------- */

export default function TrainingReadMore({
  privacy,
}: {
  privacy?: { copy: string; version: string };
}) {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState(privacy ?? null);
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
        {COPY.readMore}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={COPY.trainingTitle}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/35 p-4"
        >
          <div className="flex h-full max-h-[40rem] w-full max-w-[40rem] flex-col overflow-hidden rounded-2xl bg-background px-6 pb-6 pt-8 text-left shadow-xl">
            <div className="shrink-0 border-b border-border pb-4">
              <h2 className="text-[24px] font-semibold tracking-tight text-foreground">
                {COPY.trainingTitle}
              </h2>
              {doc ? (
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {COPY.readMoreVersion(doc.version)}
                </p>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap py-5 text-[15px] leading-[1.7] text-foreground/90">
              {doc ? trainingSection(doc.copy) : failed ? COPY.privacyUnavailable : null}
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
