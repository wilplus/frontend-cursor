"use client";

import { useEffect, useState } from "react";
import { readTalkDefinition } from "@/lib/willab/chatBuilder/talkDraft";
import { speakingCoachSeed } from "@/lib/willab/chatBuilder/seed";
import type { CoachDefinition } from "@/lib/willab/chatBuilder/types";
import type { PublishedChat } from "@/services/api/chatStructure";
import { readSetup } from "@/services/api/hostSetup";
import LoadingState from "../LoadingState";
import { useBackDismiss } from "../useBackDismiss";
import { useUserId } from "../useUserId";
import VisitorTry from "./hostsetup/VisitorTry";
import { LetterCircle } from "./ChatList";
import { TopBar } from "./TopBar";

export default function BuiltChatSection({ name, mainId = "main", published, onBack }: {
  name: string; mainId?: string; published?: PublishedChat | null; onBack: () => void;
}) {
  useBackDismiss(onBack);
  const owner = useUserId();
  const [doc, setDoc] = useState<CoachDefinition | null>(() => {
    if (!published) return readTalkDefinition();
    const seed = speakingCoachSeed();
    return { ...seed, name, chat: { ...seed.chat, ...published }, walk: { ...seed.walk, steps: [] } };
  });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (doc) return;
    let here = true;
    void readSetup().then((result) => {
      if (!here) return;
      const recipe = result?.recipe;
      if (!recipe) { setFailed(true); return; }
      const seed = speakingCoachSeed();
      setDoc({
        ...seed, name,
        chat: { ...seed.chat, name, spec: recipe.spec, line: recipe.line, hello: recipe.hello,
          questions: recipe.questions, taps: recipe.taps, send: recipe.send },
        walk: { ...seed.walk, steps: [] },
      });
    }).catch(() => { if (here) setFailed(true); });
    return () => { here = false; };
  }, [doc, name]);
  const title = name;
  const id = mainId;
  return <div className="absolute inset-0 z-30 flex flex-col bg-background">
    {doc && owner ? <VisitorTry key={`${owner}:${id}`} name={title} doc={doc} sends={doc.chat.send} onBack={onBack}
      section={{ id, owner }} /> :
      <>
        <TopBar title={title} circle={<LetterCircle id={title} name={title} size={36} />} onBack={onBack} />
        {failed ? <p className="px-4 py-5 text-sm">This chat isn’t ready yet.</p> : <LoadingState placement="surface" />}
      </>}
  </div>;
}
