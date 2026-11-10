"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { getBundleWho, getBundles, splitBundle, type Bundle, type BundleWho } from "@/services/api/assistants";
import { onAnswerSent, type AnswerFor } from "@/lib/willab/chatAnswer";
import { MarkDot } from "./HostChat";
import { LetterCircle } from "./ChatList";

/* -------------------------------------------------------------------------- */
/*  One recording answers everyone who asked the same thing: the queue in     */
/*  Will's chat (backend N584, N580 item 2). Each bundle still waiting is one */
/*  card (N602 item 1), all in the backend's words: "{n} people asked", the   */
/*  question, large; the faces of who asked; the assistant's note once it    */
/*  has answered them; "See who asked ›"; and "Record one answer", which     */
/*  opens the recording screens on the question; the Take then goes to       */
/*  everyone in the bundle (chatAnswer.ts). "See who asked ›" opens the sheet */
/*  "Who asked" (N602 item 2): each person's own words and name, then "Split */
/*  them up ›", which picks questions out into a bundle of their own. A      */
/*  bundle already answered is not shown. Behind the ring row `chat_builder`: */
/*  without it, or on a backend without the routes, the reads are 404 and    */
/*  nothing draws. Was (N584 item 2): the line "{n} people asked: {question}" */
/*  and every asker's question on the card.                                 */
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

/** What "Record one answer" hands the recording screens: the question, as
 *  the one slide, and the bundle it answers. */
export function bundleAnswer(bundle: Bundle): AnswerFor {
  return { chatId: `bundle:${bundle.id}`, name: bundle.faces[0] ?? "", question: bundle.question, customer: false, bundle: bundle.id };
}

/** The sheet "Who asked" (N602 item 2): each person's own words and name;
 *  "Split them up ›" turns the rows into picks, and "Split them up" sends
 *  the picked ones into a bundle of their own. */
function WhoAsked({ who, bundleId, onClose, onSplit }: { who: BundleWho; bundleId: string; onClose: () => void; onSplit: () => void }) {
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((now) => (now.includes(id) ? now.filter((p) => p !== id) : [...now, id]));
  const split = async () => {
    if (picked.length === 0) return;
    if (await splitBundle(bundleId, picked)) onSplit();
  };
  return (
    <div data-bundle-who="" className="fixed inset-0 z-30 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        role="dialog"
        aria-label={who.title}
        className="flex max-h-[80%] flex-col gap-3 overflow-y-auto rounded-t-3xl bg-background px-[18px] pb-6 pt-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <span aria-hidden className="h-[5px] w-10 self-center rounded-full bg-[#E0E0E0]" />
        <p className="mt-1 text-[21px] font-bold leading-tight text-foreground">{who.title}</p>
        <ul className="flex flex-col gap-3">
          {who.people.map((p) => {
            const on = picked.includes(p.id);
            const row = (
              <>
                <LetterCircle id={p.chat || p.id} name={p.name ?? ""} size={36} />
                <span className="min-w-0 flex-1 text-left">
                  {p.name ? <span className="block text-[12.5px] font-medium text-muted-foreground">{p.name}</span> : null}
                  <span className="flex items-start gap-2 text-[15px] leading-snug text-foreground">
                    <span className="mt-1.5">
                      <MarkDot mark={p.mark} />
                    </span>
                    {p.words}
                  </span>
                </span>
                {picking ? (
                  <span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${on ? "border-foreground bg-foreground text-background" : "border-border"}`}>
                    {on ? <Check className="h-4 w-4" /> : null}
                  </span>
                ) : null}
              </>
            );
            return (
              <li key={p.id} data-bundle-asker={p.id}>
                {picking ? (
                  <button type="button" aria-pressed={on} onClick={() => toggle(p.id)} className="flex w-full items-start gap-3">
                    {row}
                  </button>
                ) : (
                  <div className="flex items-start gap-3">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
        {who.split && who.people.length > 1 ? (
          picking ? (
            <button
              type="button"
              data-bundle-split-send=""
              disabled={picked.length === 0}
              onClick={() => void split()}
              className="flex h-12 items-center justify-center rounded-full bg-foreground text-[15px] font-medium text-background disabled:opacity-40"
            >
              {who.split}
            </button>
          ) : (
            <button type="button" data-bundle-split="" onClick={() => setPicking(true)} className="self-start text-[15px] font-medium text-foreground">
              {who.split} ›
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}

/** One bundle, one card (N602 item 1). */
function BundleCard({ bundle, onRecord, onSee }: { bundle: Bundle; onRecord: (answer: AnswerFor) => void; onSee: () => void }) {
  return (
    <div data-bundle={bundle.id} className="mr-auto flex w-[92%] flex-col gap-2.5 rounded-[16px] border border-border bg-background px-4 py-3.5">
      {bundle.faces.length > 1 ? <span data-bundle-title="" className="text-[13px] font-medium text-muted-foreground">{bundle.title}</span> : null}
      <span data-bundle-question="" className="text-[19px] font-semibold leading-snug text-foreground">
        {bundle.question}
      </span>
      <span data-bundle-faces="" className="flex -space-x-2">
        {bundle.faces.slice(0, 5).map((name, i) => (
          <LetterCircle key={`${name}-${i}`} id={`${bundle.id}-${i}`} name={name} size={36} />
        ))}
      </span>
      {bundle.note ? <span data-bundle-note="" className="text-[14px] text-muted-foreground">{bundle.note}</span> : null}
      {bundle.see ? (
        <button type="button" data-bundle-see="" onClick={onSee} className="self-start text-[15px] font-medium text-foreground">
          {bundle.see} ›
        </button>
      ) : null}
      {bundle.record ? (
        <button
          type="button"
          data-bundle-record=""
          onClick={() => onRecord(bundleAnswer(bundle))}
          className="flex h-11 items-center justify-center gap-2.5 rounded-full bg-foreground text-[15px] font-medium text-background"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
          {bundle.record}
        </button>
      ) : null}
    </div>
  );
}

export default function BundleQueue({ signedIn, onRecord }: { signedIn: boolean | undefined; onRecord?: (answer: AnswerFor) => void }) {
  const { bundles, reload } = useBundles(signedIn);
  const [who, setWho] = useState<{ bundleId: string; who: BundleWho } | null>(null);
  const waiting = bundles.filter((b) => b.record);
  if (!onRecord || waiting.length === 0) return null;
  const see = async (bundleId: string) => {
    const got = await getBundleWho(bundleId);
    if (got) setWho({ bundleId, who: got });
  };
  return (
    <div data-bundle-queue="" className="flex flex-col gap-2">
      {waiting.map((bundle) => (
        <BundleCard key={bundle.id} bundle={bundle} onRecord={onRecord} onSee={() => void see(bundle.id)} />
      ))}
      {who ? (
        <WhoAsked
          who={who.who}
          bundleId={who.bundleId}
          onClose={() => setWho(null)}
          onSplit={() => {
            setWho(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
