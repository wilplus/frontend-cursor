"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getTakeAnswers, type TakeAnswer, type TakeAnswers as Gathered } from "@/services/api/assistants";
import type { ChatMessage } from "@/services/api/chats";
import { LetterCircle } from "./ChatList";
import { GATHER_COPY as C } from "./assistantCopy";

/* -------------------------------------------------------------------------- */
/*  One Take, its answers in one place (backend N587 items 3 to 5, N588 item  */
/*  4). Under my own Take in a chat, one bubble: the faces of everyone who    */
/*  answered (nobody is hidden), and my coach's answer with the best of the  */
/*  others, by name. A tap opens all of them under the backend's two         */
/*  headings, "On your speaking" and "On the matter", each with the way into */
/*  that person's chat. Only I see it: the route answers the sender alone.   */
/*  Which answers the bubble names is the backend's choice, never a score    */
/*  (Never 1). Behind the ring row `chat_builder`: the route is 404 without  */
/*  it, or for a Take sent nowhere, and nothing is drawn.                    */
/* -------------------------------------------------------------------------- */

/** The Take a message of mine carries, else null. */
export function myTakeOf(message: ChatMessage): string | null {
  if (!message.mine || message.kind !== "take") return null;
  const session = message.meta?.take_session_id;
  return typeof session === "string" && session ? session : null;
}

function useGathered(session: string | null): Gathered | null {
  const [gathered, setGathered] = useState<Gathered | null>(null);
  useEffect(() => {
    setGathered(null);
    if (!session) return;
    let alive = true;
    void getTakeAnswers(session).then((got) => {
      if (alive) setGathered(got);
    });
    return () => {
      alive = false;
    };
  }, [session]);
  return gathered;
}

function AnswerRow({ answer, onOpenChat }: { answer: TakeAnswer; onOpenChat?: (chatId: string) => void }) {
  const name = answer.name ?? "";
  return (
    <li data-take-answer={answer.messageId} className="flex items-center gap-2.5">
      <LetterCircle id={answer.chat} name={name} size={36} />
      <span className="min-w-0 flex-1 text-[14.5px] font-semibold text-foreground">{name}</span>
      {onOpenChat && name ? (
        <button type="button" data-take-answer-open={answer.chat} onClick={() => onOpenChat(answer.chat)} className="shrink-0 text-[13px] font-semibold underline underline-offset-[3px]">
          {C.openChat(name)}
        </button>
      ) : null}
    </li>
  );
}

/** All the answers, under the backend's headings. */
function AllAnswers({ gathered, onOpenChat, onClose }: { gathered: Gathered; onOpenChat?: (chatId: string) => void; onClose: () => void }) {
  return (
    <div data-take-answers-all="" className="flex flex-col gap-3 rounded-[16px] border border-border bg-background px-3.5 py-3">
      {gathered.groups.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h4 className="text-[13px] font-semibold text-muted-foreground">{group.title}</h4>
          <ul className="flex flex-col gap-2">
            {group.answers.map((answer) => (
              <AnswerRow key={answer.messageId} answer={answer} onOpenChat={onOpenChat} />
            ))}
          </ul>
        </section>
      ))}
      <button type="button" onClick={onClose} className="self-end text-[13px] font-medium text-muted-foreground">
        {C.close}
      </button>
    </div>
  );
}

/** A message, and under my own Take the answers gathered to it. */
export function TakeAnswersUnder({ message, onOpenChat, children }: { message: ChatMessage; onOpenChat?: (chatId: string) => void; children: ReactNode }) {
  const gathered = useGathered(myTakeOf(message));
  const [all, setAll] = useState(false);
  if (!gathered || gathered.faces.length === 0) return <>{children}</>;
  const named = gathered.shown.map((a) => a.name).filter((n): n is string => !!n);
  return (
    <div className="flex flex-col gap-1.5">
      {children}
      {all ? (
        <AllAnswers gathered={gathered} onOpenChat={onOpenChat} onClose={() => setAll(false)} />
      ) : (
        <button
          type="button"
          data-take-answers=""
          onClick={() => setAll(true)}
          className="ml-auto flex max-w-[85%] items-center gap-2 rounded-[16px] bg-muted px-3 py-2 text-left text-[14px] text-foreground"
        >
          <span aria-hidden className="flex -space-x-2">
            {gathered.faces.map((face, i) => (
              <LetterCircle key={`${face}-${i}`} id={`${face}-${i}`} name={face} size={36} />
            ))}
          </span>
          <span className="min-w-0">{C.answered(named.length ? named : gathered.faces)}</span>
        </button>
      )}
    </div>
  );
}
