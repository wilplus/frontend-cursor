"use client";

import { useRef, useState } from "react";
import Linkified from "./Linkified";

/* -------------------------------------------------------------------------- */
/*  WillQuestion — Will's one question after a Take (founder 2026-10-20, N82; */
/*  prototype https://claude.ai/artifact/HSRfvDZLDRQizmGJDxMUJz).             */
/*                                                                            */
/*  The backend writes the question as the Take's one ask (kind "text",        */
/*  metadata.offer "will_question") with its tap answers in metadata.chips:    */
/*  what the Take said, what the speaker said for an earlier talk, then the   */
/*  signed answers for their field ("Someone else" last on who it is for,     */
/*  N319 item 8). While it is the newest bubble the answers sit under it, on  */
/*  the right; a tap goes to the backend, which writes it and the reply.      */
/*  Typed words in the message box are an answer too (the backend's chat      */
/*  reads them), and so is a voice answer: while it waits the mic is orange   */
/*  (N296 state 2, WillVoiceAnswer.tsx). No Skip (founder 2026-10-31, N296    */
/*  item 2): not answering is allowed, the "+" still opens the projects; a   */
/*  follow-up and the key line (N294 item 2) have no taps.                    */
/* -------------------------------------------------------------------------- */

export const WILL_QUESTION = "will_question";

export type WillQuestionTarget = { arcId: string; takeSessionId: string };

/** Will's question (or its follow-up) in a row's metadata, else null. */
export function willQuestionOf(
  meta: Record<string, unknown> | null | undefined,
): (WillQuestionTarget & { chips: string[] }) | null {
  if (meta?.offer !== WILL_QUESTION) return null;
  const arcId = meta.arc_id;
  const takeSessionId = meta.take_session_id;
  if (typeof arcId !== "string" || typeof takeSessionId !== "string") return null;
  const chips = Array.isArray(meta.chips) ? meta.chips.filter((c): c is string => typeof c === "string") : [];
  return { arcId, takeSessionId, chips };
}

/** Will's question (or its follow-up) waiting for an answer: the newest
 *  bubble drawn (messages oldest first). While it waits the Lounge's mic is
 *  orange and records the answer (backend N296 state 2). */
export function willWaiting(
  drawn: readonly { metadata?: Record<string, unknown> | null }[],
): WillQuestionTarget | null {
  const meta = drawn[drawn.length - 1]?.metadata;
  const will = willQuestionOf(meta);
  const step = meta?.will_question_step;
  return will && (step === "ask" || step === "follow") ? { arcId: will.arcId, takeSessionId: will.takeSessionId } : null;
}

export default function WillQuestionBubble({
  body,
  chips,
  open,
  onAnswer,
}: {
  body: string;
  chips: string[];
  /** The newest bubble: its answers are there to tap. */
  open: boolean;
  onAnswer?: (choice: string) => Promise<void> | void;
}) {
  // One tap at a time: a second tap before the thread reads again is dropped.
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const tap = (choice: string) => {
    if (sending.current || !onAnswer) return;
    sending.current = true;
    setBusy(true);
    void Promise.resolve(onAnswer(choice)).finally(() => {
      sending.current = false;
      setBusy(false);
    });
  };
  return (
    <>
      <div data-row="app" data-will-question="" className="mr-auto flex max-w-[85%] flex-col">
        <div data-bubble="" className="whitespace-pre-wrap break-words rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
          <Linkified text={body} />
        </div>
      </div>
      {open && chips.length > 0 ? (
        <TapRow labels={chips} disabled={busy} onTap={tap} dataAttr={{ "data-will-answers": "" }} />
      ) : null}
    </>
  );
}

/** Orange outlined taps on the right of the thread, where the speaker's own
 *  messages go: Will's tap answers, "I want to continue my practice" under
 *  the goodbye after a Take (N294 item 6), and the plan's answers before
 *  the walk (N319 item 1). A `quiet` label keeps the shape, grey and
 *  quieter: the plan's "Not now". */
export function TapRow({
  labels,
  quiet = [],
  disabled = false,
  onTap,
  dataAttr,
}: {
  labels: string[];
  quiet?: readonly string[];
  disabled?: boolean;
  onTap: (label: string) => void;
  dataAttr: Record<string, string>;
}) {
  return (
    <div {...dataAttr} className="ml-auto flex max-w-[90%] flex-wrap justify-end gap-1.5 pt-0.5">
      {labels.map((label) => (
        <button
          key={label}
          type="button"
          disabled={disabled}
          onClick={() => onTap(label)}
          data-quiet={quiet.includes(label) ? "" : undefined}
          className={`rounded-full border-[1.5px] bg-background px-3 py-1.5 text-[14.5px] disabled:opacity-60 ${
            quiet.includes(label)
              ? "border-[#E2E2E2] font-medium text-[#737373] opacity-70"
              : "border-primary font-semibold text-primary"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
