"use client";

import { useCallback, useEffect, useState } from "react";
import { getBundles, type Bundle } from "@/services/api/assistants";
import { onAnswerSent, type AnswerFor } from "@/lib/willab/chatAnswer";
import { MarkDot } from "./HostChat";

/* -------------------------------------------------------------------------- */
/*  One recording answers everyone who asked the same thing: the queue in     */
/*  Will's chat (backend N584 items 1 to 3, N580 item 2). Each bundle still   */
/*  waiting for an answer is one card: its line in the backend's words ("{n}  */
/*  people asked: {question}", or "{name} asked: {question}"), each person's  */
/*  question with its colour for how sure the match is (never a number), and */
/*  the backend's "Record one answer", which opens the recording screens on   */
/*  the question; the Take then goes to everyone in the bundle               */
/*  (chatAnswer.ts). A bundle already answered is not shown: later askers    */
/*  get its answer by themselves. Behind the ring row `chat_builder`: the    */
/*  read is 404 without it and the queue draws nothing.                      */
/* -------------------------------------------------------------------------- */

export function useBundles(signedIn: boolean | undefined): { bundles: Bundle[]; reload: () => void } {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const reload = useCallback(() => {
    void getBundles().then((got) => setBundles(got ?? []));
  }, []);
  useEffect(() => {
    if (signedIn) reload();
  }, [signedIn, reload]);
  // A bundle's answer was sent: read the queue again.
  useEffect(() => onAnswerSent((chatId) => (chatId.startsWith("bundle:") ? reload() : undefined)), [reload]);
  return { bundles, reload };
}

/** What "Record one answer" hands the recording screens: the first
 *  question asked, as the one slide, and the bundle it answers. */
export function bundleAnswer(bundle: Bundle): AnswerFor {
  const first = bundle.questions[0];
  return { chatId: `bundle:${bundle.id}`, name: first?.name ?? "", question: first?.words ?? "", customer: false, bundle: bundle.id };
}

export default function BundleQueue({ signedIn, onRecord }: { signedIn: boolean | undefined; onRecord?: (answer: AnswerFor) => void }) {
  const { bundles } = useBundles(signedIn);
  const waiting = bundles.filter((b) => b.record);
  if (!onRecord || waiting.length === 0) return null;
  return (
    <div data-bundle-queue="" className="flex flex-col gap-2">
      {waiting.map((bundle) => (
        <div key={bundle.id} data-bundle={bundle.id} className="mr-auto flex w-[92%] flex-col gap-2 rounded-[16px] border border-border bg-background px-3.5 py-3">
          <span className="text-[15px] font-semibold leading-snug text-foreground">{bundle.line}</span>
          <ul className="flex flex-col gap-1.5">
            {bundle.questions.map((q) => (
              <li key={q.id} data-bundle-question="" className="flex items-start gap-2 text-[14px] leading-snug text-foreground">
                <span className="mt-1.5">
                  <MarkDot mark={q.mark} />
                </span>
                <span className="min-w-0">
                  {q.name ? <span className="block text-[12px] font-medium text-muted-foreground">{q.name}</span> : null}
                  {q.words}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            data-bundle-record=""
            onClick={() => onRecord(bundleAnswer(bundle))}
            className="flex h-11 items-center justify-center gap-2.5 rounded-full bg-foreground text-[15px] font-medium text-background"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
            {bundle.record}
          </button>
        </div>
      ))}
    </div>
  );
}
