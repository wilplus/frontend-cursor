"use client";

import { CANCEL } from "./joinCopy";

/* -------------------------------------------------------------------------- */
/*  "Ask {name}" (backend N483 item 4, N498; the locked prototype "The Bar,  */
/*  Clickable" v12): the "+" in a chat with a person opens it, a sheet from  */
/*  the bottom built like "Add someone to chat with". The title, the black   */
/*  "Record your question", the three steps before your first question only, */
/*  and Cancel; no line (N498 item 1). "Record your question" always opens   */
/*  the recording screens on the default presentation.                       */
/* -------------------------------------------------------------------------- */

/** Signed (N483 item 6), naming the person and saying "they". */
export const askName = (name: string) => `Ask ${name}`;
export const RECORD_YOUR_QUESTION = "Record your question";
export const askSteps = (name: string): readonly (readonly [string, string])[] => [
  ["1. Ask one thing", "A clear question gets a clear answer"],
  [`2. ${name} answers`, "Out loud, when they have a moment"],
  ["3. It stays here", "Play it again whenever you need it"],
];

export default function AskSheet({
  name,
  firstTime,
  onRecord,
  onClose,
}: {
  name: string;
  /** Before your first question: the three steps show. */
  firstTime: boolean;
  onRecord: () => void;
  onClose: () => void;
}) {
  return (
    <div data-ask-sheet className="absolute inset-0 z-30 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        role="dialog"
        aria-label={askName(name)}
        className="flex flex-col gap-3.5 rounded-t-3xl bg-background px-[18px] pb-6 pt-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <span aria-hidden className="h-[5px] w-10 self-center rounded-full bg-[#E0E0E0]" />
        <p className="mt-1 text-[21px] font-bold leading-tight text-foreground">{askName(name)}</p>
        <button
          type="button"
          data-record-question=""
          onClick={onRecord}
          className="flex h-[54px] items-center justify-center gap-2.5 rounded-full bg-foreground text-[16px] font-semibold text-background"
        >
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-red-500" />
          {RECORD_YOUR_QUESTION}
        </button>
        {firstTime ? (
          <div data-ask-steps className="grid grid-cols-3 gap-2">
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
