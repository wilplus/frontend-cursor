"use client";

import { useEffect, useRef, useState } from "react";
import Linkified from "../Linkified";
import { SOMETHING_ELSE, TapRow } from "../WillQuestion";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { answerJoinSetup, getMyChatLink, getMyProfile, joinSetupAgain } from "@/services/api/chats";
import { COPIED, COPY_MY_LINK, JOIN_SETUP_NONE, YOUR_JOIN_QUESTIONS, joinedAsks, joinedThanks } from "./joinCopy";

/* -------------------------------------------------------------------------- */
/*  Will's setup for the one who shares (backend N487 items 2 and 3, N503;    */
/*  the prototype "Asked When They Join", v18; rules: docs/flows/             */
/*  customer-requests.md C1). The backend writes it into Will's chat, one     */
/*  question at a time (`services/join_setup.py`, metadata.join_setup):       */
/*  Will's lines, his questions with their answers to tap ("Something else"  */
/*  first, N483 item 2), the summary as someone new will see it with "Change  */
/*  it" and "That's right", and "You're set." with "Copy my link ›" and "Your */
/*  questions for people who join ›". A tap, or the words typed after        */
/*  "Something else" or under "What should change?", go to the backend,      */
/*  which writes them and Will's next lines; the thread is then read again.  */
/* -------------------------------------------------------------------------- */

type JoinLine = { q: string; answers: string[]; multi: boolean };
export type JoinSetup = { step: string; chips: string[]; lines: JoinLine[] };

const WAITS = new Set(["plan", "languages", "more", "peek", "change"]);

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** Will's row of the setup, else null (one's own answers are drawn as any). */
export function joinSetupOf(message: Pick<LoungeMessage, "role" | "metadata">): JoinSetup | null {
  const raw = message.metadata?.join_setup;
  if (message.role !== "bot" || !raw || typeof raw !== "object") return null;
  const setup = raw as Record<string, unknown>;
  const lines = Array.isArray(setup.lines)
    ? setup.lines.flatMap((line) => {
        const l = line as Record<string, unknown> | null;
        return l && typeof l.q === "string" ? [{ q: l.q, answers: strings(l.answers), multi: l.multi === true }] : [];
      })
    : [];
  return { step: typeof setup.step === "string" ? setup.step : "say", chips: strings(setup.chips), lines };
}

/** Will's setup question waiting for an answer: the newest bubble drawn
 *  (messages oldest first). `words`: he asks for words alone ("What should
 *  change?"), so the box stays open (N483 item 2). */
export function joinSetupWaiting(
  drawn: readonly Pick<LoungeMessage, "client_id" | "role" | "metadata">[],
): { to: string; words: boolean } | null {
  const last = drawn[drawn.length - 1];
  const setup = last ? joinSetupOf(last) : null;
  if (!last || !setup || !WAITS.has(setup.step)) return null;
  return { to: last.client_id, words: setup.chips.length === 0 };
}

/** What Will's chat does with the setup: a tap, typed words, the summary
 *  again; each then reads the thread again. */
export function useJoinSetup(reload: () => Promise<void>, setThinking: (on: boolean) => void) {
  const run = async (work: () => Promise<boolean>) => {
    setThinking(true);
    try {
      if (await work()) await reload();
    } finally {
      setThinking(false);
    }
  };
  return {
    tap: (to: string, picked: string) => run(() => answerJoinSetup(to, { picked })),
    say: (to: string, said: string) => run(() => answerJoinSetup(to, { said })),
    again: () => run(joinSetupAgain),
  };
}

/** The summary: what someone new will see when they open the chat (N487
 *  item 3), the line at the top with one's own name, then each question with
 *  the answers they tap, the likely one filled (none where several fit). */
function JoinSummary({ lines }: { lines: JoinLine[] }) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void getMyProfile().then((profile) => {
      if (alive) setName(profile?.name.trim().split(/\s+/)[0] || null);
    });
    return () => {
      alive = false;
    };
  }, []);
  const asks = lines.some((line) => line.q.endsWith("?"));
  return (
    <div data-join-summary="" data-row="app" className="mr-auto flex w-[92%] flex-col gap-1.5 rounded-[16px] border border-border bg-background px-3.5 py-3">
      {name ? (
        <span className="self-center rounded-xl bg-muted px-2.5 py-1.5 text-center text-[12px] leading-snug">
          {asks ? joinedAsks(name) : joinedThanks(name)}
        </span>
      ) : null}
      {lines.length === 0 ? <span className="text-center text-[13px] text-muted-foreground">{JOIN_SETUP_NONE}</span> : null}
      {lines.map((line) => (
        <div key={line.q} className="flex flex-col gap-1">
          <span className="max-w-[90%] self-start rounded-[14px] bg-muted px-2.5 py-1 text-[13px]">{line.q}</span>
          {line.answers.length ? (
            <span className="flex max-w-[92%] flex-wrap justify-end gap-1 self-end">
              {line.answers.map((answer, i) => (
                <span
                  key={answer}
                  className={`rounded-[14px] border-[1.5px] border-[#F26B21] px-2 py-0.5 text-[12px] font-semibold ${!line.multi && i === line.answers.length - 1 ? "bg-[#F26B21] text-white" : "bg-background text-[#F26B21]"}`}
                >
                  {answer}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LinkLine({ label, onTap }: { label: string; onTap: () => void }) {
  return (
    <button type="button" onClick={onTap} className="mr-auto flex items-center gap-1.5 px-0.5 py-1.5 text-[15px] font-medium text-foreground">
      {label}
      {label === COPIED ? null : <span aria-hidden className="text-[20px] leading-none text-muted-foreground">›</span>}
    </button>
  );
}

/** "Copy my link ›", then "✓ Copied" (N502 item 6). */
export function CopyLinkLine() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const path = await getMyChatLink();
    if (!path) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
    } catch {
      // The clipboard is refused: "+" still opens the link to select.
    }
  };
  return <LinkLine label={copied ? COPIED : COPY_MY_LINK} onTap={() => void copy()} />;
}

/** One of Will's setup rows: his line, the summary, the links at the end,
 *  and, while it is the newest bubble, the answers to tap. */
export function JoinSetupBubble({
  message,
  setup,
  open,
  onTap,
  onAgain,
  onWords,
}: {
  message: LoungeMessage;
  setup: JoinSetup;
  open: boolean;
  onTap: (picked: string) => Promise<void>;
  onAgain: () => Promise<void>;
  /** "Something else" opens the box for one's own words (N483 item 2). */
  onWords: () => void;
}) {
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const tap = (label: string) => {
    if (label === SOMETHING_ELSE) return onWords();
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    void onTap(label).finally(() => {
      sending.current = false;
      setBusy(false);
    });
  };
  // The likely answer comes first from the backend and sits nearest the
  // thumb (N371); the summary's two have no "Something else".
  const labels = setup.step === "peek" ? [...setup.chips].reverse() : [SOMETHING_ELSE, ...[...setup.chips].reverse()];
  return (
    <>
      {message.body ? (
        <div data-row="app" data-join-setup={setup.step} className="mr-auto flex max-w-[85%] flex-col">
          <div data-bubble="" className="whitespace-pre-wrap break-words rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
            <Linkified text={message.body} />
          </div>
        </div>
      ) : null}
      {setup.step === "peek" ? <JoinSummary lines={setup.lines} /> : null}
      {setup.step === "set" ? <CopyLinkLine /> : null}
      {setup.step === "set" || setup.step === "saved" ? <LinkLine label={YOUR_JOIN_QUESTIONS} onTap={() => void onAgain()} /> : null}
      {open && setup.chips.length > 0 ? (
        <TapRow labels={labels} disabled={busy} onTap={tap} dataAttr={{ "data-join-setup-answers": "" }} />
      ) : null}
    </>
  );
}
