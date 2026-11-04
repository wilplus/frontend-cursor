"use client";

import { useEffect, useState } from "react";
import { VoicePlayer } from "@/components/willab/plan/VoicePlayer";
import { TapRow } from "@/components/willab/WillQuestion";
import { NOT_NOW } from "@/lib/willab/leaveWords";
import { onAnswerSent, usePendingAnswer, type AnswerFor } from "@/lib/willab/chatAnswer";
import type { Chat } from "@/services/api/chats";
import { acceptInquiry, declineInquiry, getInquiry, inquiryAudioSrc, type Inquiry, type InquiryTake } from "@/services/api/takeMatches";
import { OPEN_TAKE } from "./ChatList";
import { askingForWhatYouKnow, itsAbout } from "./joinCopy";
import { BackIsThisChats, ChatTopBar, FileBubble, JoinedLine, RecordAnswerButton, SendingPill, TakeTile, VoiceWords } from "./ChatThread";

/* -------------------------------------------------------------------------- */
/*  An asking chat: a matched Take that reached me (backend N477, N478, N485, */
/*  N486, N493, N504; #1712). Rules: docs/flows/customer-requests.md C1.      */
/*                                                                            */
/*    before Open Take  who asks (a pseudonym and their role) and what it is  */
/*                      about, never a name; "Open Take" in the bar's middle, */
/*                      black with no dot (it opens something first, N483     */
/*                      item 1); "Not now" under the question.                */
/*    after Open Take   the asker's name and the Take, open: its recording    */
/*                      and its words slide by slide, never its Ideal Text,   */
/*                      feedback or levels (N479 item 8); "Record your        */
/*                      answer", recorded over the Take's own slides (N493    */
/*                      item 1); "Not now" still removes it (N493 item 4).    */
/*    sending           "Sending to {name}… {n}" with Undo; once it counts    */
/*                      the chat with the asker is made, and they see me then */
/*                      (N486 item 1).                                        */
/*                                                                            */
/*  "Not now" tells nobody; the backend keeps it on the match (N504 item 2).  */
/* -------------------------------------------------------------------------- */

/** The id an asking chat goes by in the list and in the answer's pending
 *  state, apart from the chats' own ids. */
export const inquiryChatId = (id: string) => `inquiry:${id}`;

export default function InquiryThread({
  chat,
  inquiry,
  open = true,
  onBack,
  onGone,
  onRecordAnswer,
}: {
  chat: Chat;
  inquiry: Inquiry;
  open?: boolean;
  onBack: () => void;
  /** Declined, or answered: the list reads its chats again. */
  onGone: () => void;
  onRecordAnswer?: (answer: AnswerFor) => void;
}) {
  const [shown, setShown] = useState<Inquiry | InquiryTake>(inquiry);
  const [busy, setBusy] = useState(false);
  const pending = usePendingAnswer(chat.id);

  useEffect(() => {
    let live = true;
    void getInquiry(inquiry.id).then((read) => {
      if (live && read) setShown(read);
    });
    return () => {
      live = false;
    };
  }, [inquiry.id]);

  // The answer counted: the chat with the asker is made; back to the list.
  useEffect(() => onAnswerSent((chatId) => chatId === chat.id && onGone()), [chat.id, onGone]);

  const accepted = shown.state !== "new";
  const take = accepted && "words" in shown ? shown : null;
  const name = accepted ? shown.name || shown.pseudonym : shown.pseudonym;
  const top: Chat = { ...chat, title: name, subtitle: shown.role ?? "" };

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    const read = await acceptInquiry(shown.id);
    setBusy(false);
    if (read) setShown(read);
  };
  const decline = async () => {
    if (busy) return;
    setBusy(true);
    await declineInquiry(shown.id);
    setBusy(false);
    onGone();
  };
  const record = () =>
    onRecordAnswer?.({
      chatId: chat.id,
      name,
      question: shown.about,
      customer: false,
      slides: take?.slideTitles.length ? take.slideTitles : undefined,
      inquiry: shown.id,
    });

  return (
    <div data-chat-screen data-inquiry={shown.id} className="relative flex min-h-0 flex-1 flex-col">
      {open ? <BackIsThisChats onBack={onBack} /> : null}
      <ChatTopBar chat={top} onBack={onBack} onOpen={() => undefined} />
      <div data-chat-thread className="scrollbar-none flex flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-3 pt-4">
        <div data-rhythm className="mt-auto flex flex-col gap-2">
          {accepted ? null : <JoinedLine text={askingForWhatYouKnow(shown.pseudonym)} />}
          {shown.about ? (
            <div data-row="app" className="mr-auto flex max-w-[88%]">
              <div data-inquiry-about="" className="whitespace-pre-wrap break-words rounded-[16px] bg-muted px-3 py-2 text-[15px] leading-[1.45] text-foreground">
                {itsAbout(shown.about)}
              </div>
            </div>
          ) : null}
          {take ? (
            <div data-chat-take="" className="flex flex-col gap-2">
              <FileBubble mine={false} time="">
                <TakeTile meta={{ project_title: shown.about, duration_ms: take.durationMs }} first={take.slideTitles[0] ?? null} />
                <span data-chat-take-open="" className="flex flex-col px-1 pt-1">
                  <VoicePlayer src={inquiryAudioSrc(shown.id)} tone="grey" durationMs={take.durationMs} />
                  {take.words ? <VoiceWords words={take.words} mine={false} /> : null}
                </span>
              </FileBubble>
            </div>
          ) : null}
          {pending ? null : <TapRow labels={[NOT_NOW]} onTap={() => void decline()} dataAttr={{ "data-chat-not-now": "" }} />}
        </div>
      </div>
      <div data-chat-bar className="flex shrink-0 items-end gap-1 px-4 pb-2">
        {pending ? (
          <SendingPill name={pending.name} startedAt={pending.startedAt} waited={pending.waited} failed={pending.failed} />
        ) : accepted ? (
          onRecordAnswer ? <RecordAnswerButton onClick={record} /> : null
        ) : (
          <button
            type="button"
            data-inquiry-open-take=""
            onClick={() => void accept()}
            className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-full bg-foreground text-[15px] font-medium text-background"
          >
            {OPEN_TAKE}
          </button>
        )}
      </div>
    </div>
  );
}
