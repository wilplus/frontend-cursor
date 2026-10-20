"use client";

import { useRef, useState } from "react";
import Linkified from "./Linkified";
import { CHIP_LABEL } from "./loungePrompts";

/* -------------------------------------------------------------------------- */
/*  WillQuestion — Will's one question after a Take (founder 2026-10-20, N82; */
/*  prototype https://claude.ai/artifact/HSRfvDZLDRQizmGJDxMUJz).             */
/*                                                                            */
/*  The backend writes the question as the Take's one ask (kind "text",        */
/*  metadata.offer "will_question") with its tap answers in metadata.chips:    */
/*  what the Take said, what the speaker said for an earlier talk, then the   */
/*  signed answers for their field. While it is the newest bubble the answers */
/*  sit under it, with Skip; a tap goes to the backend, which writes it and   */
/*  the reply (thanks, or the one follow-up). Typed words in the message box  */
/*  are an answer too (the backend's chat reads them).                         */
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
      {open ? (
        <div data-will-answers="" className="ml-auto flex max-w-[90%] flex-wrap justify-end gap-1.5 pt-0.5">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy}
              onClick={() => tap(chip)}
              className="rounded-full border-[1.5px] border-primary bg-background px-3 py-1.5 text-[14.5px] font-semibold text-primary disabled:opacity-60"
            >
              {chip}
            </button>
          ))}
          <button
            type="button"
            data-will-skip=""
            disabled={busy}
            onClick={() => tap(CHIP_LABEL.feedback_skip)}
            className="rounded-full bg-muted px-3 py-1.5 text-[14.5px] text-foreground disabled:opacity-60"
          >
            {CHIP_LABEL.feedback_skip}
          </button>
        </div>
      ) : null}
    </>
  );
}
