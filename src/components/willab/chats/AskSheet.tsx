"use client";

import { Image as ImageIcon, Keyboard } from "lucide-react";
import { TYPE_YOUR_ANSWER } from "@/components/willab/WillQuestion";
import { CANCEL } from "./joinCopy";

/* -------------------------------------------------------------------------- */
/*  The "+" sheet in a chat with a person (backend N610 item 7, the locked   */
/*  page "The Bar, To Lock"; before it N483 item 4, N498): a sheet from the  */
/*  bottom built like "Add someone to chat with".                            */
/*                                                                            */
/*    nothing asked   "Ask {name}": the black "Record your question" (where   */
/*                    the chat takes recordings), then "Send a photo"; the    */
/*                    three steps before your first question only (N498).     */
/*                    "Record your question" always opens the recording       */
/*                    screens on the default presentation.                    */
/*    the chat asks   "Answer {name}": "Type your answer" where the chat      */
/*                    takes typing as well as recordings, then "Send a        */
/*                    photo". The middle of the bar already records.          */
/*                                                                            */
/*  The middle's "Ask {name}" opens the first one too.                        */
/* -------------------------------------------------------------------------- */

/** Signed (N483 item 6, N610 item 7), naming the person and saying "they". */
export const askName = (name: string) => `Ask ${name}`;
export const answerName = (name: string) => `Answer ${name}`;
export const RECORD_YOUR_QUESTION = "Record your question";
export const SEND_A_PHOTO = "Send a photo";
export const askSteps = (name: string): readonly (readonly [string, string])[] => [
  ["1. Ask one thing", "A clear question gets a clear answer"],
  [`2. ${name} answers`, "Out loud, when they have a moment"],
  ["3. It stays here", "Play it again whenever you need it"],
];

const ROW = "flex h-11 items-center gap-2.5 rounded-xl bg-[#F5F5F5] px-3 text-left text-[14px] font-semibold text-[#121212]";

export default function AskSheet({
  name,
  answers = false,
  firstTime,
  onRecord,
  onType,
  onPhoto,
  onClose,
}: {
  name: string;
  /** The chat asks and the bar's middle answers: "Answer {name}". */
  answers?: boolean;
  /** Before your first question: the three steps show. */
  firstTime: boolean;
  /** "Record your question"; absent where the chat takes no recordings. */
  onRecord?: () => void;
  /** "Type your answer"; absent unless typing is on beside recording. */
  onType?: () => void;
  onPhoto: () => void;
  onClose: () => void;
}) {
  const title = answers ? answerName(name) : askName(name);
  return (
    <div data-ask-sheet className="absolute inset-0 z-30 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="flex flex-col gap-2 rounded-t-3xl bg-background px-[18px] pb-6 pt-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <span aria-hidden className="h-[5px] w-10 self-center rounded-full bg-[#E0E0E0]" />
        <p className="mb-1 mt-1 text-[21px] font-bold leading-tight text-foreground">{title}</p>
        {!answers && onRecord ? (
          <button
            type="button"
            data-record-question=""
            onClick={onRecord}
            className="flex h-11 items-center justify-center gap-2.5 rounded-full bg-[#121212] text-[14px] font-semibold text-white"
          >
            <span aria-hidden className="h-[9px] w-[9px] rounded-full bg-red-500" />
            {RECORD_YOUR_QUESTION}
          </button>
        ) : null}
        {answers && onType ? (
          <button type="button" data-type-answer="" onClick={onType} className={ROW}>
            <Keyboard className="h-[18px] w-[18px]" aria-hidden />
            {TYPE_YOUR_ANSWER}
          </button>
        ) : null}
        <button type="button" data-send-photo="" onClick={onPhoto} className={ROW}>
          <ImageIcon className="h-[18px] w-[18px]" aria-hidden />
          {SEND_A_PHOTO}
        </button>
        {!answers && onRecord && firstTime ? (
          <div data-ask-steps className="mt-1 grid grid-cols-3 gap-2">
            {askSteps(name).map(([head, rest]) => (
              <div key={head} className="rounded-xl bg-muted px-2.5 py-2.5 text-[12.5px] leading-snug text-muted-foreground">
                <b className="mb-0.5 block text-[13px] font-semibold text-foreground">{head}</b>
                {rest}
              </div>
            ))}
          </div>
        ) : null}
        <button type="button" onClick={onClose} className="h-10 text-[15px] font-medium text-muted-foreground">
          {CANCEL}
        </button>
      </div>
    </div>
  );
}
