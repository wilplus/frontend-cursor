"use client";

import { composerModes, sendCombos, takesFromSend, ThanksTaps } from "@/components/willab/chats/ChatBar";
import ChatComposer, { type ComposerFileAction } from "@/components/willab/chats/ChatComposer";

/* -------------------------------------------------------------------------- */
/*  Every They-send bar, so a host can see it before it is in a chat.         */
/*                                                                            */
/*  15 non-empty combinations of rec / text / photo / file, and the four      */
/*  states: nothing asked, the chat asks, a photo asked, thanks.              */
/*  DEV ONLY. Production renders nothing. Open /dev/chat-bar.                 */
/* -------------------------------------------------------------------------- */

const NAME = "Artur";
const STATES: { label: string; asked: { answer: boolean; photo: boolean }; thanks: boolean }[] = [
  { label: "Nothing asked", asked: { answer: false, photo: false }, thanks: false },
  { label: "The chat asks", asked: { answer: true, photo: false }, thanks: false },
  { label: "A photo asked", asked: { answer: false, photo: true }, thanks: false },
  { label: "Thanks", asked: { answer: false, photo: false }, thanks: true },
];

export default function ChatBarPreview() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <main data-chat-bar-preview="" className="mx-auto flex max-w-lg flex-col gap-4 bg-background px-4 py-6 text-foreground">
      <h1 className="text-[20px] font-semibold">Composer by accepted message format</h1>
      <p className="text-[14px] text-muted-foreground">Files, text, and mic keep their positions.</p>
      {sendCombos().map((combo) => {
        const takes = takesFromSend(combo);
        if (!takes) return null;
        return STATES.map((state) => {
          const modes = composerModes(takes, state.asked);
          const files: ComposerFileAction[] = [];
          if (modes.photo) files.push({ label: "Send a photo", accept: "image/*", sendFile: () => true });
          if (modes.file) files.push({ label: "Send a file", sendFile: () => true });
          return (
            <section key={`${combo.join("+")}:${state.label}`} data-bar-case="" className="flex flex-col gap-2 rounded-2xl border border-border p-3">
              <h2 className="text-[14px] font-semibold">{combo.join(" · ")} · {state.label}</h2>
              <ChatComposer
                placeholder={state.asked.photo ? "Add a photo" : `Ask ${NAME}`}
                onSend={modes.text ? () => true : undefined}
                mic={modes.mic ? { start: () => undefined } : undefined}
                voiceRequired={state.asked.answer && modes.mic && !modes.text}
                files={files}
                above={state.thanks && !modes.text ? <ThanksTaps onPick={() => undefined} /> : null}
              />
            </section>
          );
        });
      })}
    </main>
  );
}
