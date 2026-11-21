"use client";

import { BarMiddle, BarPlus, ThanksTaps, middleOf, plusRows, sendCombos, takesFromSend, type BarAsked } from "@/components/willab/chats/ChatBar";

/* -------------------------------------------------------------------------- */
/*  Every They-send bar, so a host can see it before it is in a chat.         */
/*                                                                            */
/*  15 non-empty combinations of rec / text / photo / file, and the four      */
/*  states: nothing asked, the chat asks, a photo asked, thanks.              */
/*  DEV ONLY. Production renders nothing. Open /dev/chat-bar.                 */
/* -------------------------------------------------------------------------- */

const NAME = "Artur";
const STATES: { label: string; asked: BarAsked; thanks: boolean }[] = [
  { label: "Nothing asked", asked: { answer: false, taps: false, photo: false }, thanks: false },
  { label: "The chat asks", asked: { answer: true, taps: false, photo: false }, thanks: false },
  { label: "A photo asked", asked: { answer: false, taps: false, photo: true }, thanks: false },
  { label: "Thanks", asked: { answer: false, taps: false, photo: false }, thanks: true },
];

export default function ChatBarPreview() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <main data-chat-bar-preview="" className="mx-auto flex max-w-lg flex-col gap-4 bg-background px-4 py-6 text-foreground">
      <h1 className="text-[20px] font-semibold">The bar, for every They send</h1>
      <p className="text-[14px] text-muted-foreground">rec is a recording. text is typing. photo and file sit behind +.</p>
      {sendCombos().map((combo) => {
        const takes = takesFromSend(combo);
        if (!takes) return null;
        return STATES.map((state) => (
          <section key={`${combo.join("+")}:${state.label}`} data-bar-case="" className="flex flex-col gap-2 rounded-2xl border border-border p-3">
            <h2 className="text-[14px] font-semibold">{combo.join(" · ")} · {state.label}</h2>
            {state.thanks ? <ThanksTaps onPick={() => undefined} /> : null}
            <div data-chat-bar="" className="flex min-h-[60px] items-center gap-1">
              <BarPlus fresh={false} onClick={() => undefined} />
              <BarMiddle
                middle={middleOf(takes, state.asked)}
                name={NAME}
                typing={false}
                onAsk={() => undefined}
                onRecordAnswer={() => undefined}
                onPhoto={() => undefined}
                onType={async () => true}
                onTypingDone={() => undefined}
              />
            </div>
            <p data-plus-rows="" className="text-[13px] text-muted-foreground">+ {plusRows(takes, state.asked).join(" · ") || "nothing else"}</p>
          </section>
        ));
      })}
    </main>
  );
}
