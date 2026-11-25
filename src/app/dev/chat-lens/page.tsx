"use client";

import { useState } from "react";
import ChatLens, { CHAT_LENS_DOCK, CHAT_LENS_THREAD } from "@/components/willab/chats/ChatLens";
import { DockColumn, TapsDock, type Item } from "@/components/willab/LoungeLifeGoals";
import { STRENGTH_COPY } from "@/components/willab/LoungeStrengths";

/* A lens running in the chat (backend N691 item 5), with no account. DEV
   ONLY. Open /dev/chat-lens: the strengths lens at its question, in the
   thread, with its taps in the composer's place. */

const ITEMS: Item[] = [
  { id: 1, who: "will", node: STRENGTH_COPY.fromNotes },
  { id: 2, who: "will", node: <>“I kept calm when the client pushed back on price.”<span className="mt-1 block text-[13.5px] leading-[1.4] text-muted-foreground">Mon 17 Nov</span></> },
  { id: 3, who: "will", node: <>{STRENGTH_COPY.suggests} <b>Staying calm under pressure</b></> },
];

export default function ChatLensPage() {
  if (process.env.NODE_ENV === "production") return null;
  return <Harness />;
}

function Harness() {
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState(ITEMS);
  const dock = (
    <DockColumn>
      <TapsDock
        options={[{ label: STRENGTH_COPY.addStrength }, { label: STRENGTH_COPY.notNow }]}
        onPick={(index) => {
          const label = index === 0 ? STRENGTH_COPY.addStrength : STRENGTH_COPY.notNow;
          setItems((now) => [...now, { id: now.length + 1, who: "me", node: label },
            { id: now.length + 2, who: "will", node: index === 0 ? STRENGTH_COPY.added : STRENGTH_COPY.noted }]);
          setOpen(false);
        }}
      />
    </DockColumn>
  );
  return (
    <div className="mx-auto flex h-dvh max-w-[1080px] flex-col gap-3 px-2">
      <div data-thread data-rhythm className="flex flex-1 flex-col gap-3 overflow-y-auto pt-4">
        <div className="mt-auto mr-auto max-w-[88%] rounded-[16px] bg-muted px-3 py-2 text-[15px]">
          We spotted a strength! 💪 <span className="text-muted-foreground">›</span>
        </div>
        <div {...{ [CHAT_LENS_THREAD]: "" }} className="flex flex-col empty:hidden" />
      </div>
      <div {...{ [CHAT_LENS_DOCK]: "" }} className="peer empty:hidden" />
      <div className="peer-[:not(:empty)]:hidden mb-2 rounded-full border px-4 py-3 text-muted-foreground">Message</div>
      <ChatLens open={open} stageKey="strengths" label={STRENGTH_COPY.bar} items={items} typing={false}
        dock={dock} onClose={() => setOpen(false)} frame={() => null} />
    </div>
  );
}
